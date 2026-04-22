import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchRoomById, bookSeats, normalizeSessionMessage } from '../api/roomsApi';
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
    const [seatsToBook, setSeatsToBook] = useState(1);

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

        const safeUnsubscribe = (sub) => {
            try {
                if (typeof sub?.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            } catch {
                return;
            }
        };

        let subscription = subscribeToRoom(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            if (subscription) {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
            }
            safeUnsubscribe(subscription);
            subscription = subscribeToRoom(client);
        });

        return () => {
            cancelled = true;
            if (subscription) {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
            }
            safeUnsubscribe(subscription);
            if (typeof unsubscribeConnection === 'function') {
                unsubscribeConnection();
            }
        };
    }, [roomId]);

    if (loading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error">Ошибка: {error}</div>;
    if (!room) return <div className="error">Комната не найдена</div>;

    const participants = room.participants ?? [];
    const maxPossibleUsers = participants.length + (room.maxSeats - room.currentParticipants);
    const occupied = room.currentParticipants ?? participants.length;
    const maxSeats = room.maxSeats ?? 0;
    const maxAllowed = Math.floor(maxSeats / 2);
    const freeSeats = Math.max(maxSeats - occupied, 0);
    const maxBookable = Math.min(maxAllowed, freeSeats);
    const selectedSeats = maxBookable > 0 ? Math.min(Math.max(seatsToBook, 1), maxBookable) : 1;
    const entryFee = room.entryFee ?? 0;
    const boostCost = room.boostCost ?? 0;
    const boostMultiplier = room.boostWeightMultiplier ?? 1;
    const prizePool = room.currentPrizePool ?? 0;
    const commission = 100 - (room.prizePoolPercent ?? 100);
    const theme = room.theme ? room.theme.slice(0, -2) : 'GOLF';
    const userIsParticipant = participants.some((p) => p.userId === user?.id);
    const canIncreaseSeats = selectedSeats < maxAllowed && selectedSeats < freeSeats;
    const joinDisabled = actionLoading || (!userIsParticipant && freeSeats <= 0);

    const handleJoin = async () => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (userIsParticipant) {
            navigate(`/game/${roomId}`);
            return;
        }
        setActionLoading(true);
        try {
            await bookSeats(roomId, user.id, selectedSeats);
            await refreshUser();
            setError(null);
            navigate(`/game/${roomId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

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
                        <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#ffffff' }}>
                            {room.description || 'Описание отсутствует'}
                        </p>
                        <div className="info-row">Участники: ({participants.length}/{maxPossibleUsers})</div>
                        <div className="info-row">
                            <span className="label">Мин. мест для старта:</span>
                            <span>{room.minSeatsToStart ?? 0}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Цена входа:</span>
                            <span>{entryFee}</span>
                        </div>
                        {room.boostEnabled && (
                            <>
                                <div className="info-row">
                                    <span className="label">Стоимость буста:</span>
                                    <span>{boostCost}</span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Множитель буста:</span>
                                    <span>{boostMultiplier}</span>
                                </div>
                            </>
                        )}
                        <div className="info-row">
                            <span className="label">Призовой фонд:</span>
                            <span>{prizePool}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Комиссия:</span>
                            <span>{commission}%</span>
                        </div>
                    </div>

                    <div className="room-actions" style={{ marginLeft: '70%', width: '300px', minWidth: '200px' }}>
                        {!userIsParticipant && (
                            <>
                                <div className="info-row" style={{ justifyContent: 'center', alignItems: 'center', gap: '10px', padding: 0 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSeatsToBook((prev) => Math.max(1, Math.min(maxBookable, prev - 1)))}
                                        disabled={selectedSeats <= 1 || actionLoading}
                                        style={{ width: '44px', height: '44px', padding: 0, borderRadius: '999px', fontSize: '28px', fontWeight: 700 }}
                                    >
                                        -
                                    </button>
                                    <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 700, fontSize: '28px' }}>
                                        {selectedSeats} мест
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSeatsToBook((prev) => Math.max(1, Math.min(maxBookable, prev + 1)))}
                                        disabled={!canIncreaseSeats || actionLoading}
                                        style={{ width: '44px', height: '44px', padding: 0, borderRadius: '999px', fontSize: '28px', fontWeight: 700 }}
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="info-row" style={{ justifyContent: 'center', paddingTop: 0 }}>
                                    {(selectedSeats / maxSeats * 100).toFixed(0)}%
                                </div>
                            </>
                        )}

                        <button className="play-button" onClick={handleJoin} disabled={joinDisabled} style={{ marginLeft: 0, marginTop: 0, width: '100%' }}>
                            {actionLoading ? 'Подключение...' : userIsParticipant ? 'Вернуться в игру' : 'Присоединиться'}
                        </button>
                    </div>
                </div>
            </div>
            <section style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', color: '#333' }}>
                <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>Как работает расчет вероятности?</h3>
                <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                    В комнате всегда <strong>{maxSeats} мест</strong>. Если к концу таймера не все места выкуплены игроками, пустые места автоматически занимают боты (у них нет бустов).
                </p>
                <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                    Ваша базовая вероятность победы зависит от доли выкупленных вами мест. Например, если вы купили 2 места из 10, ваш шанс — 20%. Ни один игрок не может выкупить более 50% мест.
                </p>
                {room.boostEnabled && (
                    <div style={{ background: 'rgba(242, 165, 71, 0.15)', padding: '16px', borderRadius: '12px', marginTop: '20px' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#d47f22' }}>⚡ Усиление (Буст)</h4>
                        <p style={{ margin: 0, fontSize: '15px' }}>
                            Вы можете докупить буст на каждое из своих мест уже внутри комнаты. Каждый буст увеличивает "вес" этого места в <strong>{boostMultiplier} раза</strong> при финальном розыгрыше, отбирая долю вероятности у других участников и ботов. Ваш суммарный шанс с учетом бустов ограничен 50%.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default RoomLobbyPage;
