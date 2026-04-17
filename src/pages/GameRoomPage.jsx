import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRoomById, joinRoom, leaveRoom, startGame } from '../api/roomsApi';
import { useUser } from '../context/UserContext';

const GameRoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, updateBalance } = useUser();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [winner, setWinner] = useState(null);

    const loadRoom = async () => {
        try {
            setLoading(true);
            const data = await fetchRoomById(roomId);
            setRoom(data);
            if (data.status === 'finished' && data.winner) {
                setWinner(data.winner);
            }
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoom();
        // Можно добавить интервал для обновления комнаты
        const interval = setInterval(loadRoom, 5000);
        return () => clearInterval(interval);
    }, [roomId]);

    const handleJoin = async () => {
        setActionLoading(true);
        try {
            const result = await joinRoom(roomId, user.userId, user.username);
            setRoom(result.room);
            updateBalance(result.newBalance);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeave = async () => {
        setActionLoading(true);
        try {
            const result = await leaveRoom(roomId, user.userId);
            setRoom(result.room);
            // Баланс не меняется при выходе
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartGame = async () => {
        setActionLoading(true);
        try {
            const result = await startGame(roomId);
            setRoom(result.room);
            setWinner(result.winner);
            updateBalance(result.newBalance);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="loading">Загрузка комнаты...</div>;
    if (error) return <div className="error">Ошибка: {error}</div>;
    if (!room) return <div className="error">Комната не найдена</div>;

    const isWaiting = room.status === 'waiting';
    const isFinished = room.status === 'finished';
    const occupied = room.participants.length;
    const freeSeats = room.maxSeats - occupied;
    const userIsParticipant = room.participants.some(p => p.userId === user.userId);
    const canStart = isWaiting && occupied >= 2 && userIsParticipant; // любой участник может запустить
    const canJoin = isWaiting && !userIsParticipant && freeSeats > 0 && user.balance >= room.entryFee;

    return (
        <div className="game-room-page">
            <button className="back-btn" onClick={() => navigate('/')}>
                ← Назад к списку
            </button>

            <div className="room-header">
                <h2>Комната {room.id.slice(-6)}</h2>
                <div className="room-meta">
                    <span>👥 {occupied}/{room.maxSeats}</span>
                    <span>💰 Вход: {room.entryFee}</span>
                    <span className={`status-badge ${isWaiting ? 'waiting' : 'finished'}`}>
            {isWaiting ? 'Ожидание' : 'Завершена'}
          </span>
                </div>
            </div>

            <div className="room-layout">
                <div className="participants-panel">
                    <h3>Участники</h3>
                    <div className="participants-list">
                        {room.participants.map((p) => (
                            <div key={p.userId} className={`participant-item ${p.isBot ? 'bot' : 'human'}`}>
                                <span className="participant-icon">{p.isBot ? '🤖' : '👤'}</span>
                                <span className="participant-name">{p.username}</span>
                                {p.hasBoost && <span className="boost-badge">⚡</span>}
                                {winner && winner.userId === p.userId && (
                                    <span className="winner-badge">🏆</span>
                                )}
                            </div>
                        ))}
                        {Array.from({ length: freeSeats }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="participant-item empty">
                                <span className="participant-icon">⬤</span>
                                <span className="participant-name">Свободное место</span>
                            </div>
                        ))}
                    </div>
                    <div className="room-actions">
                        {isWaiting && (
                            <>
                                {!userIsParticipant && (
                                    <button
                                        className="join-btn"
                                        onClick={handleJoin}
                                        disabled={actionLoading || !canJoin}
                                    >
                                        {actionLoading ? '...' : '🎟️ Присоединиться'}
                                    </button>
                                )}
                                {userIsParticipant && (
                                    <>
                                        <button
                                            className="leave-btn"
                                            onClick={handleLeave}
                                            disabled={actionLoading}
                                        >
                                            🚪 Покинуть
                                        </button>
                                        {canStart && (
                                            <button
                                                className="start-game-btn"
                                                onClick={handleStartGame}
                                                disabled={actionLoading}
                                            >
                                                🎮 Начать игру
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {isFinished && winner && (
                            <div className="game-result">
                                <p>Победитель: {winner.username}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="game-area">
                    {isWaiting ? (
                        <div className="waiting-area">
                            <p>Ожидание игроков...</p>
                            {!userIsParticipant && (
                                <p className="hint">Присоединитесь, чтобы участвовать</p>
                            )}
                        </div>
                    ) : (
                        <div className="result-area">
                            <h3>Игра завершена</h3>
                            {winner ? (
                                <div className="winner-announcement">
                                    <p>Победитель:</p>
                                    <div className="winner-details">
                                        <span className="winner-icon">{winner.isBot ? '🤖' : '👤'}</span>
                                        <span className="winner-name">{winner.username}</span>
                                    </div>
                                </div>
                            ) : (
                                <p>Результат не определён</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameRoomPage;