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
    const occupied = room.currentParticipants ?? participants.length;
    const maxSeats = room.maxSeats ?? 0;
    const maxAllowed = Math.floor(maxSeats / 2);
    const freeSeats = Math.max(maxSeats - occupied, 0);
    const maxBookable = Math.max(1, Math.min(maxAllowed || 1, freeSeats || 1));
    const selectedSeats = Math.min(Math.max(seatsToBook, 1), maxBookable);
    const entryFee = room.entryFee ?? 0;
    const boostCost = room.boostCost ?? 0;
    const boostMultiplier = room.boostWeightMultiplier ?? 1;
    const prizePool = room.currentPrizePool ?? 0;
    const commission = 5;
    const theme = room.theme.slice(0, -2) ?? 'GOLF';
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
        </div>
    );
};

export default RoomLobbyPage;
