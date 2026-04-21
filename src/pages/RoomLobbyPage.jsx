import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchRoomById, joinRoom, normalizeSessionMessage } from '../api/roomsApi';
import { useUser } from '../context/useUser';
import { getStompClient, onStompConnectionChange } from '../stompClient';

const RoomLobbyPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, refreshUser } = useUser();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadRoom = async () => {
            setLoading(true);
            try {
                const data = await fetchRoomById(roomId);
                if (!cancelled) {
                    setRoom(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadRoom();

        const subscribeToRoom = (client) => {
            if (!client?.connected) return undefined;
            const destination = `/topic/session/${roomId}`;
            console.log(`[WS][SUBSCRIBE] ${destination}`);
            return client.subscribe(destination, (message) => {
                console.log(`[WS][MESSAGE] ${destination}`, message.body);
                try {
                    const payload = JSON.parse(message.body);
                    setRoom((prev) => normalizeSessionMessage(payload, prev));
                } catch (e) {
                    console.error('Session update error', e);
                }
            });
        };

        let subscription = subscribeToRoom(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            if (subscription) {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
            }
            subscription?.unsubscribe();
            subscription = subscribeToRoom(client);
        });

        return () => {
            cancelled = true;
            if (subscription) {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
            }
            subscription?.unsubscribe();
            unsubscribeConnection();
        };
    }, [roomId]);

    const handlePlay = async () => {
        if (!user) {
            navigate('/login');
            return;
        }
        setActionLoading(true);
        try {
            await joinRoom(roomId, user.id, user.username);
            await refreshUser();
            setError(null);
            navigate(`/game/${roomId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error">Ошибка: {error}</div>;
    if (!room) return <div className="error">Комната не найдена</div>;

    const participants = room.participants ?? [];
    const occupied = room.currentParticipants ?? participants.length;
    const maxSeats = room.maxSeats ?? 0;
    const entryFee = room.entryFee ?? 0;
    const boostCost = room.boostCost ?? 0;
    const boostMultiplier = room.boostWeightMultiplier ?? 1;
    const prizePool = room.currentPrizePool ?? 0;
    const commission = 5;
    const theme = room.theme.slice(0,-2) ?? "GOLF";
    const isWaiting = room.status === 'WAITING' || room.status === 'FILLING';
    const userIsParticipant = participants.some(p => p.userId === user?.id);
    console.log(theme, `${theme}T`)
    console.log(room)

    return (
        <div className="lobby-page">
            <div className="lobby-header">
                <button className="back-button" onClick={() => navigate('/')}>
                    ❬
                </button>
                <button className="profile-button" onClick={() => navigate('/account')}>
                    Профиль
                </button>
            </div>

            <div className="lobby-container">
                <div className={`info-block ${theme}T`}>
                    <div className="info-text">
                        <h2>{room.name || `Комната ${roomId.slice(-6)}`}</h2>
                        <div className="info-row">
                            <span className="label">Участники:</span>
                            <span>{occupied} / {maxSeats}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Цена входа:</span>
                            <span>{entryFee}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Стоимость буста:</span>
                            <span>{boostCost}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Множитель буста:</span>
                            <span>{boostMultiplier}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Призовой фонд:</span>
                            <span>{prizePool}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Комиссия:</span>
                            <span>{commission}%</span>
                        </div>
                    </div>
                    <button className="play-button" onClick={handlePlay}  disabled={actionLoading}>
                        {actionLoading ? 'Подключение...' : userIsParticipant ? 'Вернуться в игру' : 'Играть'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoomLobbyPage;
