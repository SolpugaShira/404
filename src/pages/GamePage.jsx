// GamePage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    fetchRoomById,
    fetchWinnerByRoomId,
    activateBoost,
    leaveRoom,
    normalizeSessionMessage,
    normalizeRoundMessage,
} from '../api/roomsApi';
import { useUser } from '../context/useUser';
import { getStompClient, onStompConnectionChange } from '../stompClient';

const GamePage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, refreshUser, isAuthenticated } = useUser();

    // Проверка авторизации
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { replace: true, state: { from: `/game/${roomId}` } });
        }
    }, [isAuthenticated, navigate, roomId]);

    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [winner, setWinner] = useState(null);
    const [displaySecondsLeft, setDisplaySecondsLeft] = useState(0);
    const [leavingRoom, setLeavingRoom] = useState(false);

    const roomSnapshotRef = useRef(null);
    const subscriptionsRef = useRef([]);
    const unsubscribeConnectionRef = useRef(null);
    const mountedRef = useRef(true);
    const initialLoadDoneRef = useRef(false); // флаг завершения первой загрузки

    // Очистка при размонтировании
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Стабильное слияние состояния комнаты
    const mergeStableRoomState = useCallback((nextRoom, previousRoom = null) => {
        const stableRoom = roomSnapshotRef.current ?? previousRoom;

        if (!nextRoom && !stableRoom) return null;

        const mergedRoom = {
            ...stableRoom,
            ...previousRoom,
            ...nextRoom,
            name: nextRoom?.name || stableRoom?.name || previousRoom?.name || 'Комната',
            maxSeats: nextRoom?.maxSeats || stableRoom?.maxSeats || previousRoom?.maxSeats || 0,
            entryFee: nextRoom?.entryFee || stableRoom?.entryFee || previousRoom?.entryFee || 0,
            currentParticipants:
                nextRoom?.currentParticipants ??
                nextRoom?.participants?.length ??
                previousRoom?.currentParticipants ??
                stableRoom?.currentParticipants ??
                0,
            participants:
                nextRoom?.participants ?? previousRoom?.participants ?? stableRoom?.participants ?? [],
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
    }, []);

    // Таймер обратного отсчёта
    useEffect(() => {
        if (!room || room.status === 'COMPLETED') {
            setDisplaySecondsLeft(0);
            return;
        }

        const calculateSecondsLeft = () => {
            if (!room.timerStartedAt) return Math.max(room.secondsLeft ?? 60, 60);
            const seconds = (-Date.now() + room.timerStartedAt) / 1000 + 60;
            return Math.round(Math.max(seconds, 0));
        };

        setDisplaySecondsLeft(calculateSecondsLeft());

        const intervalId = setInterval(() => {
            if (mountedRef.current) {
                setDisplaySecondsLeft(calculateSecondsLeft());
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [room]);

    // Загрузка комнаты при монтировании
    useEffect(() => {
        if (!roomId) {
            navigate('/lobby', { replace: true });
            return;
        }

        let cancelled = false;
        const loadRoom = async () => {
            try {
                setLoading(true);
                const data = await fetchRoomById(roomId);
                if (cancelled || !mountedRef.current) return;

                setRoom((prev) => mergeStableRoomState(data, prev));
                if (data?.status === 'COMPLETED') {
                    const latestWinner = data.result ?? (await fetchWinnerByRoomId(roomId).catch(() => null));
                    if (mountedRef.current) setWinner(latestWinner);
                }
                setError(null);
            } catch (err) {
                if (!cancelled && mountedRef.current) {
                    setError(err.message);
                    if (err.message.includes('404')) {
                        setTimeout(() => navigate('/lobby', { replace: true }), 2000);
                    }
                }
            } finally {
                if (!cancelled && mountedRef.current) {
                    setLoading(false);
                    initialLoadDoneRef.current = true;
                }
            }
        };

        loadRoom();

        return () => {
            cancelled = true;
        };
    }, [roomId, navigate, mergeStableRoomState]);

    // WebSocket подписки
    useEffect(() => {
        const safeUnsubscribe = (subscription) => {
            if (!subscription) return;
            try {
                const client = getStompClient();
                // Если клиент отсутствует или не подключен — отписка не нужна
                if (!client || !client.connected) {
                    return;
                }
                if (typeof subscription.unsubscribe === 'function') {
                    console.log('[WS][UNSUBSCRIBE] GamePage subscription');
                    subscription.unsubscribe();
                }
            } catch (e) {
                // Подавляем только ошибки, связанные с закрытым сокетом
                const errorMsg = e?.message || '';
                if (!errorMsg.includes('CLOSING') && !errorMsg.includes('CLOSED')) {
                    console.warn('[GamePage] Unsubscribe error:', e);
                }
            }
        };

        const unsubscribeAll = () => {
            subscriptionsRef.current.forEach(safeUnsubscribe);
            subscriptionsRef.current = [];
        };

        const subscribeToTopics = (client) => {
            if (!client?.connected) {
                console.warn('[WS] disconnected: skip GamePage subscriptions');
                return;
            }

            unsubscribeAll();

            try {
                const sessionDestination = `/topic/session/${roomId}`;
                console.log(`[WS][SUBSCRIBE] ${sessionDestination}`);
                const sessionSub = client.subscribe(sessionDestination, (message) => {
                    try {
                        console.log(`[WS][MESSAGE] ${sessionDestination}`, message.body);
                        const payload = JSON.parse(message.body);
                        if (!mountedRef.current) return;

                        // Данные пришли — загрузка завершена
                        if (!initialLoadDoneRef.current) {
                            setLoading(false);
                            initialLoadDoneRef.current = true;
                        }

                        setRoom((prev) => {
                            const nextRoom = normalizeSessionMessage(payload, prev);
                            if (nextRoom?.status === 'COMPLETED' && nextRoom.result) {
                                setWinner(nextRoom.result);
                            }
                            return mergeStableRoomState(nextRoom, prev);
                        });
                    } catch (e) {
                        console.error('[GamePage] Session message parse error:', e);
                    }
                });

                const roundDestination = `/topic/round/${roomId}`;
                console.log(`[WS][SUBSCRIBE] ${roundDestination}`);
                const roundSub = client.subscribe(roundDestination, (message) => {
                    try {
                        console.log(`[WS][MESSAGE] ${roundDestination}`, message.body);
                        if (mountedRef.current) {
                            setWinner(normalizeRoundMessage(JSON.parse(message.body)));
                        }
                    } catch (e) {
                        console.error('[GamePage] Round message parse error:', e);
                    }
                });

                subscriptionsRef.current = [sessionSub, roundSub];
            } catch (e) {
                console.error('[GamePage] Subscription error:', e);
            }
        };

        const client = getStompClient();
        if (client?.connected) {
            subscribeToTopics(client);
        }

        unsubscribeConnectionRef.current = onStompConnectionChange((newClient) => {
            subscribeToTopics(newClient);
        });

        return () => {
            unsubscribeAll();
            if (typeof unsubscribeConnectionRef.current === 'function') {
                unsubscribeConnectionRef.current();
            }
        };
    }, [roomId, mergeStableRoomState]);

    // Активация буста
    const handleActivateBoost = async () => {
        if (!user) return;
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


    if (!isAuthenticated) {
        return <div className="loading">Проверка авторизации...</div>;
    }

    if (loading) return <div className="loading">Загрузка игры...</div>;
    if (error) return (
        <div className="error">
            Ошибка: {error}
            <button onClick={() => navigate('/lobby')}>Вернуться в лобби</button>
        </div>
    );
    if (!room) return <div className="error">Комната не найдена</div>;

    const participants = room.participants ?? [];
    const isWaiting = room.status === 'WAITING' || room.status === 'FILLING';
    const isFinished = room.status === 'COMPLETED';
    const userIsParticipant = participants.some((p) => p.userId === user?.id);
    const currentUserParticipant = participants.find((p) => p.userId === user?.id) ?? null;

    const canActivateBoost =
        isWaiting &&
        userIsParticipant &&
        room.boostEnabled &&
        !currentUserParticipant?.hasBoost &&
        user?.balance >= (room.boostCost ?? 0);

    // Расчёт шанса на победу
    const winPercent = (() => {
        if (!userIsParticipant || !currentUserParticipant) return 0;
        const totalWeight = participants.reduce((sum, p) => sum + (p.weight || 1), 0);
        const userWeight = currentUserParticipant.weight || 1;
        return totalWeight > 0 ? Math.round((userWeight / totalWeight) * 100) : 0;
    })();
    const theme = `${room.theme.slice(0,-2)}G` ?? "GOLFG";
    // console.log(theme)
    return (
        <div className="game-page">
            {/* Header */}
            <header className="game-header">
                <button className="back-button" onClick={() => navigate('/')}>
                    ❬
                </button>
                <div className="prize-pool">
                    призовой фонд: <strong>{room.currentPrizePool ?? 0}</strong>
                </div>
                <div className="header-actions">
                    <button className="profile-button" onClick={() => navigate('/account')}>
                        профиль
                    </button>
                </div>
            </header>

            <div className="game-main-row">
                {/* Левая панель — игроки */}
                <aside className="players-panel">
                    <h3>Игроки ({participants.length}/{room.maxSeats})</h3>
                    <ul className="players-list">
                        {participants.map((p) => (
                            <li key={p.userId ?? p.username} className={`player-item ${p.isBot ? 'bot' : 'human'}`}>
                                <span className="player-name">{p.username}</span>
                                {p.hasBoost && <span className="boost-indicator">⚡</span>}
                                {winner && winner.username === p.username && (
                                    <span className="winner-crown">🏆</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Правая панель — игра */}
                <main className={`game-area ${theme}-${participants.length < 5 ? participants.length : 5}`}>
                    {isWaiting && (
                        <div className="waiting-state">
                            <p className="timer">До автозапуска: {displaySecondsLeft} сек.</p>
                            {userIsParticipant && (
                                <>
                                    <div className="win-chance">
                                        Ваш шанс на победу: <strong>{winPercent}%</strong>
                                    </div>
                                    {room.boostEnabled && (
                                        <button
                                            className="boost-button"
                                            onClick={handleActivateBoost}
                                            disabled={actionLoading || !canActivateBoost}
                                        >
                                            {currentUserParticipant?.hasBoost
                                                ? 'Буст активирован'
                                                : `Повысить шанс (${room.boostCost ?? 0})`}
                                        </button>
                                    )}
                                </>
                            )}
                            {!userIsParticipant && (
                                <p className="hint">Вы наблюдатель. Ожидайте начала игры.</p>
                            )}
                        </div>
                    )}

                    {isFinished && (
                        <div className="finished-state">
                            {winner ? (
                                <div className="winner-announcement">
                                    <span className="winner-name">{winner.username}</span>
                                    <span className="winner-prize"> выиграл {room.currentPrizePool ?? 0} баллов!</span>
                                </div>
                            ) : (
                                <p>Результат не определён</p>
                            )}
                            <div className="game-visual-placeholder">
                            </div>
                            <button className="back-to-lobby-btn" onClick={() => navigate('/')}>
                                Вернуться в лобби
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default GamePage;
