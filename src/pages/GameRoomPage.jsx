import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    activateBoost,
    fetchRoomById,
    fetchWinnerByRoomId,
    joinRoom,
    normalizeSessionMessage,
} from '../api/roomsApi';
import { useUser } from '../context/useUser';
import { getStompClient, onStompConnectionChange } from '../stompClient';

const GameRoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, refreshUser } = useUser();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [winner, setWinner] = useState(null);
    const [displaySecondsLeft, setDisplaySecondsLeft] = useState(0);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [socketState, setSocketState] = useState({
        connected: false,
        sessionSubscribed: false,
    });
    const roomSnapshotRef = useRef(null);
    const winnerRef = useRef(null);

    useEffect(() => {
        winnerRef.current = winner;
    }, [winner]);

    const mergeStableRoomState = (nextRoom, previousRoom = null) => {
        const stableRoom = roomSnapshotRef.current ?? previousRoom;

        if (!nextRoom && !stableRoom) {
            return null;
        }

        const mergedRoom = {
            ...stableRoom,
            ...previousRoom,
            ...nextRoom,
            name: nextRoom?.name || stableRoom?.name || previousRoom?.name || 'Комната',
            maxSeats: nextRoom?.maxSeats || stableRoom?.maxSeats || previousRoom?.maxSeats || 0,
            entryFee: nextRoom?.entryFee || stableRoom?.entryFee || previousRoom?.entryFee || 0,
            currentParticipants: nextRoom?.currentParticipants
                ?? nextRoom?.participants?.length
                ?? previousRoom?.currentParticipants
                ?? stableRoom?.currentParticipants
                ?? 0,
            participants: nextRoom?.participants ?? previousRoom?.participants ?? stableRoom?.participants ?? [],
        };

        roomSnapshotRef.current = {
            ...roomSnapshotRef.current,
            id: mergedRoom.id,
            roomId: mergedRoom.roomId,
            sessionId: mergedRoom.sessionId,
            name: mergedRoom.name,
            maxSeats: mergedRoom.maxSeats,
            entryFee: mergedRoom.entryFee,
            currentPrizePool: mergedRoom.currentPrizePool ?? 0,
            boostEnabled: mergedRoom.boostEnabled ?? false,
            boostCost: mergedRoom.boostCost ?? 0,
            boostWeightMultiplier: mergedRoom.boostWeightMultiplier ?? 0,
            description: mergedRoom.description ?? '',
        };

        return mergedRoom;
    };

    useEffect(() => {
        const calculateSecondsLeft = () => {
            if (!room || room.status === 'COMPLETED') {
                return 0;
            }

            if (!room.timerStartedAt) {
                return Math.max(room.secondsLeft ?? 60, 60);
            }

            let seconds = (- Date.now() + room.timerStartedAt)/1000 +60;

            // const elapsedSeconds = Math.floor((Date.now() - room.timerStartedAt) / 1000);
            // const initialSecondsLeft = room.secondsLeft ?? seconds;
            return Math.round(Math.max(seconds, 0));
        };

        setDisplaySecondsLeft(calculateSecondsLeft());

        if (!room || room.status === 'COMPLETED') {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setDisplaySecondsLeft(calculateSecondsLeft());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    });
    useEffect((winner) => (winner), [displaySecondsLeft]);
    useEffect(() => {
        let cancelled = false;

        const loadRoom = async () => {
            setLoading(true);

            try {
                const data = await fetchRoomById(roomId);
                if (cancelled) {
                    return;
                }

                setRoom((prev) => mergeStableRoomState(data, prev));

                if (data?.status === 'COMPLETED') {
                    const latestWinner = data.result ?? await fetchWinnerByRoomId(roomId).catch(() => null);
                    if (!cancelled) {
                        setWinner(latestWinner);
                    }
                } else if (!cancelled) {
                    setWinner(null);
                }

                setError(null);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadRoom();

        return () => {
            cancelled = true;
        };
    }, [roomId]);

    useEffect(() => {
        const subscribeToRoomTopics = (client) => {
            if (!client?.connected) {
                console.log('[WS] disconnected: skip room subscriptions');
                setSocketState({
                    connected: false,
                    sessionSubscribed: false,
                });
                return [];
            }

            fetchRoomById(roomId)
                .then((data) => {
                    setRoom((prev) => mergeStableRoomState(data, prev));

                    if (data?.status === 'COMPLETED') {
                        if (data.result) {
                            setWinner(data.result);
                            return;
                        }

                        if (!winnerRef.current) {
                            fetchWinnerByRoomId(roomId)
                                .then((latestWinner) => {
                                    setWinner(latestWinner);
                                })
                                .catch(console.error);
                        }
                    }
                })
                .catch(console.error);

            const destination = `/topic/session/${roomId}`;
            console.log(`[WS][SUBSCRIBE] ${destination}`);
            const sessionSub = client.subscribe(destination, (message) => {
                console.log(`[WS][MESSAGE] ${destination}`, message.body);
                try {
                    const payload = JSON.parse(message.body);
                    setRoom((prev) => {
                        const nextRoom = normalizeSessionMessage(payload, prev);
                        if (nextRoom?.status === 'COMPLETED' && nextRoom.result) {
                            setWinner(nextRoom.result);
                        }
                        return mergeStableRoomState(nextRoom, prev);
                    });
                } catch (parseError) {
                    console.error('Session parse error:', parseError);
                }
            });

            setSocketState({
                connected: true,
                sessionSubscribed: true,
            });

            return [sessionSub];
        };

        let subscriptions = subscribeToRoomTopics(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            subscriptions.forEach((subscription) => {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
                try { if (typeof subscription.unsubscribe === 'function') { subscription.unsubscribe(); } } catch { /* ignore unsubscribe errors */ }
            });
            subscriptions = subscribeToRoomTopics(client);
        });

        return () => {
            subscriptions.forEach((subscription) => {
                console.log(`[WS][UNSUBSCRIBE] /topic/session/${roomId}`);
                try { if (typeof subscription.unsubscribe === 'function') { subscription.unsubscribe(); } } catch { /* ignore unsubscribe errors */ }
            });
            setSocketState({
                connected: false,
                sessionSubscribed: false,
            });
            unsubscribeConnection();
        };
    }, [roomId]);

    const handleJoin = async () => {
        setActionLoading(true);
        try {
            await joinRoom(roomId, user.id, user.username);
            await refreshUser();
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleActivateBoost = async () => {
        setActionLoading(true);
        try {
            await activateBoost(roomId, user.id);
            await refreshUser();
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="loading">Загрузка комнаты...</div>;
    }

    if (error) {
        return <div className="error">Ошибка: {error}</div>;
    }

    if (!room) {
        return <div className="error">Комната не найдена</div>;
    }

    const participants = room.participants ?? [];
    const isWaiting = room.status === 'WAITING' || room.status === 'FILLING';
    const isFinished = room.status === 'COMPLETED';
    const occupied = room.currentParticipants ?? participants.length;
    const freeSeats = Math.max((room.maxSeats ?? 0) - occupied, 0);
    const userIsParticipant = participants.some((participant) => participant.userId === user.id);
    const currentUserParticipant = participants.find((participant) => participant.userId === user.id) ?? null;
    const canJoin = isWaiting
        && !userIsParticipant
        && freeSeats > 0
        && user.balance >= room.entryFee;
    const canActivateBoost = isWaiting
        && userIsParticipant
        && room.boostEnabled
        && !currentUserParticipant?.hasBoost
        && user.balance >= (room.boostCost ?? 0);

    const roomDetails = [
        { label: 'ID комнаты', value: room.roomId ?? room.id ?? '—' },
        { label: 'ID сессии', value: room.sessionId ?? '—' },
        { label: 'Название', value: room.name ?? '—' },
        { label: 'Статус', value: room.status ?? '—' },
        { label: 'Игроков', value: `${occupied}/${room.maxSeats ?? 0}` },
        { label: 'Свободно', value: freeSeats },
        { label: 'Вход', value: room.entryFee ?? 0 },
        { label: 'Призовой фонд', value: room.currentPrizePool ?? 0 },
        { label: 'Таймер', value: `${displaySecondsLeft} c` },
        { label: 'Буст', value: room.boostEnabled ? 'Да' : 'Нет' },
        { label: 'Цена буста', value: room.boostCost ?? 0 },
        { label: 'Множитель буста', value: room.boostWeightMultiplier ?? '—' },
        { label: 'WebSocket', value: socketState.connected ? 'Подключен' : 'Не подключен' },
        { label: 'Sub /session', value: socketState.sessionSubscribed ? 'Активна' : 'Нет' },
        { label: 'Описание', value: room.description || '—' },
    ];

    return (
        <div className="game-room-page">
            <button className="back-btn" onClick={() => navigate('/')}>
                Назад к списку
            </button>

            <div className="room-header">
                <h2>{room.name ?? `Комната ${String(room.roomId ?? room.id).slice(-6)}`}</h2>
                <div className="room-meta">
                    <span>{occupied}/{room.maxSeats} игроков</span>
                    <span>Вход: {room.entryFee}</span>
                    <span className={`status-badge ${isWaiting ? 'waiting' : 'finished'}`}>
                        {isWaiting ? 'Ожидание' : 'Завершена'}
                    </span>
                </div>
            </div>

            <div className="room-layout">
                <div className="participants-panel">
                    <h3>Участники</h3>
                    <div className="participants-list">
                        {participants.map((participant) => (
                            <div
                                key={participant.userId ?? participant.username}
                                className={`participant-item ${participant.isBot ? 'bot' : 'human'}`}
                            >
                                <span className="participant-icon">{participant.isBot ? 'Bot' : 'User'}</span>
                                <span className="participant-name">{participant.username}</span>
                                {participant.hasBoost && <span className="boost-badge">Boost</span>}
                                {winner && winner.username === participant.username && (
                                    <span className="winner-badge">Winner</span>
                                )}
                            </div>
                        ))}
                        {Array.from({ length: freeSeats }).map((_, index) => (
                            <div key={`empty-${index}`} className="participant-item empty">
                                <span className="participant-icon">Empty</span>
                                <span className="participant-name">Свободное место</span>
                            </div>
                        ))}
                    </div>

                    <div className="room-actions">
                        {isWaiting && !userIsParticipant && (
                            <button
                                className="join-btn"
                                onClick={handleJoin}
                                disabled={actionLoading || !canJoin}
                            >
                                {actionLoading ? '...' : 'Присоединиться'}
                            </button>
                        )}

                        {isWaiting && userIsParticipant && room.boostEnabled && (
                            <button
                                className="boost-btn"
                                onClick={handleActivateBoost}
                                disabled={!canActivateBoost}
                            >
                                {currentUserParticipant?.hasBoost
                                    ? 'Буст активирован'
                                    : `Купить и активировать за ${room.boostCost ?? 0}`}
                            </button>
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
                            {/*<p>{data.length}</p>*/}
                            <p className="hint">До автозапуска: {displaySecondsLeft} c</p>
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
                                        <span className="winner-icon">{winner.isBot ? 'Bot' : 'User'}</span>
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

            <button
                type="button"
                className="details-toggle-btn"
                onClick={() => setDetailsOpen((prev) => !prev)}
            >
                {detailsOpen ? 'Скрыть информацию о комнате' : 'Показать информацию о комнате'}
            </button>

            {detailsOpen && (
                <section className="room-debug-panel">
                    {roomDetails.map((item) => (
                        <article key={item.label} className="room-debug-card">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                        </article>
                    ))}
                </section>
            )}
        </div>
    );
};

export default GameRoomPage;

