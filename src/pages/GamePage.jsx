// GamePage.jsx
import {GOLF1, GOLF2, GOLF3, GOLF4, GOLF5} from "../assets/Animations/golfg1.jsx";
import React, {useEffect, useState, useRef, useCallback} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    fetchRoomById,
    fetchWinnerByRoomId,
    activateBoost,
    normalizeSessionMessage,
    normalizeRoundMessage,
} from '../api/roomsApi';
import { useUser } from '../context/useUser';
import { getStompClient, onStompConnectionChange } from '../stompClient';
import {TENNIS1, TENNIS2} from "../assets/Animations/tennisg2.jsx";
import {TENNIS3} from "../assets/Animations/tennisg4.jsx";

const DEFAULT_GAME_THEME = 'GOLFG';

const animationDurations = {
    TENNISG: 10000,
    TENNIS4G: 10000,
    GOLFG: 4000,
    RACINGG: 1500,
};

const animationMap = {
    GOLFG: [GOLF1, GOLF2, GOLF3, GOLF4, GOLF5],
    TENNISG: [TENNIS1, TENNIS2],
    TENNIS4G: [TENNIS3],
    RACINGG: [],
};

const getGameTheme = (roomTheme) => {
    if (!roomTheme || typeof roomTheme !== 'string') return DEFAULT_GAME_THEME;
    if (animationDurations[roomTheme]) return roomTheme;
    return `${roomTheme.slice(0, -2)}G`;
};

const getAnimationDuration = (roomTheme) => animationDurations[getGameTheme(roomTheme)] ?? 10000;

const getParticipantCount = (participants) => (Array.isArray(participants) ? participants.length : 0);

const getVisualGameTheme = (roomTheme, participants) => {
    const gameTheme = getGameTheme(roomTheme);
    return gameTheme === 'TENNISG' && getParticipantCount(participants) >= 4 ? 'TENNIS4G' : gameTheme;
};

const getRandomAnimationComponent = (gameTheme) => {
    const animationComponents = animationMap[gameTheme] || [];
    if (animationComponents.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * animationComponents.length);
    return animationComponents[randomIndex];
};


const GamePage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, refreshUser, isAuthenticated } = useUser();

    // ===== Все хуки на верхнем уровне =====
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [winner, setWinner] = useState(null);
    const [displaySecondsLeft, setDisplaySecondsLeft] = useState(0);

    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState(3);
    const [showAnimation, setShowAnimation] = useState(false);
    const [currentAnimationComponent, setCurrentAnimationComponent] = useState(null);
    const countdownTimersRef = useRef([]);

    const roomSnapshotRef = useRef(null);
    const subscriptionsRef = useRef([]);
    const unsubscribeConnectionRef = useRef(null);
    const mountedRef = useRef(true);
    const initialLoadDoneRef = useRef(false);



    // Логирование монтирования компонента
    // console.log('[GamePage] Render. showCountdown:', showCountdown, 'showAnimation:', showAnimation, 'displaySecondsLeft:', displaySecondsLeft);
    // Очистка при размонтировании
    useEffect(() => {
        mountedRef.current = true;
        console.log('[GamePage] Mounted');
        return () => {
            mountedRef.current = false;
            countdownTimersRef.current.forEach(clearTimeout);
            console.log('[GamePage] Unmounted');
        };
    }, []);

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
            participants: nextRoom?.participants ?? previousRoom?.participants ?? stableRoom?.participants ?? [],
        };
        roomSnapshotRef.current = {
            ...roomSnapshotRef.current,
            theme: mergedRoom.theme,
            id: mergedRoom.id,
            roomId: mergedRoom.roomId,
            sessionId: mergedRoom.sessionId,
            name: mergedRoom.name,
            maxSeats: mergedRoom.maxSeats,
            entryFee: mergedRoom.entryFee,
            participants: mergedRoom.participants ?? [],
            currentPrizePool: mergedRoom.currentPrizePool ?? 0,
            boostEnabled: mergedRoom.boostEnabled ?? false,
            boostCost: mergedRoom.boostCost ?? 0,
            boostWeightMultiplier: mergedRoom.boostWeightMultiplier ?? 0,
            description: mergedRoom.description ?? '',
        };
        console.log('[GamePage] mergeStableRoomState:', mergedRoom);
        return mergedRoom;
    }, []);

    // Таймер обратного отсчёта (от сервера)
    useEffect(() => {
        if (!room || room.status === 'COMPLETED') {
            const resetTimerId = setTimeout(() => {
                if (mountedRef.current) setDisplaySecondsLeft(0);
            }, 0);
            console.log('[GamePage] Timer reset (no room or completed)');
            return () => clearTimeout(resetTimerId);
        }
        const calculateSecondsLeft = () => {
            if (!room.timerStartedAt) return Math.max(room.secondsLeft ?? 10, 10);
            const seconds = (-Date.now() + room.timerStartedAt) / 1000 + 10;
            return Math.round(Math.max(seconds, 0));
        };
        const update = () => {
            const sec = calculateSecondsLeft();
            setDisplaySecondsLeft(sec);
            console.log('[GamePage] Timer update:', sec);
        };
        update();
        const intervalId = setInterval(() => {
            if (mountedRef.current) {
                update();
            }
        }, 1000);
        return () => clearInterval(intervalId);
    }, [room]);

    // Проверка авторизации
    useEffect(() => {
        if (!isAuthenticated) {
            console.log('[GamePage] Not authenticated, redirect to login');
            navigate('/login', { replace: true, state: { from: `/game/${roomId}` } });
        }
    }, [isAuthenticated, navigate, roomId]);

    // Загрузка комнаты
    useEffect(() => {
        if (!roomId) {
            console.log('[GamePage] No roomId, redirect to lobby');
            navigate('/lobby', { replace: true });
            return;
        }
        let cancelled = false;
        const loadRoom = async () => {
            try {
                setLoading(true);
                console.log('[GamePage] Fetching room data...');
                const data = await fetchRoomById(roomId);
                if (cancelled || !mountedRef.current) return;
                setRoom((prev) => mergeStableRoomState(data, prev));
                if (data?.status === 'COMPLETED') {
                    const latestWinner = data.result ?? (await fetchWinnerByRoomId(roomId).catch(() => null));
                    if (mountedRef.current) setWinner(latestWinner);
                }
                setError(null);
                console.log('[GamePage] Room data loaded:', data);
            } catch (err) {
                if (!cancelled && mountedRef.current) {
                    console.error('[GamePage] Failed to load room:', err);
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
                if (!client || !client.connected) return;
                if (typeof subscription.unsubscribe === 'function') {
                    subscription.unsubscribe();
                }
            } catch {
                return;
            }
        };
        const unsubscribeAll = () => {
            subscriptionsRef.current.forEach(safeUnsubscribe);
            subscriptionsRef.current = [];
        };
        const subscribeToTopics = (client) => {
            if (!client?.connected) return;
            console.log('[GamePage] Subscribing to WebSocket topics...');
            unsubscribeAll();
            fetchRoomById(roomId)
                .then((data) => {
                    if (!mountedRef.current) return;
                    setRoom((prev) => mergeStableRoomState(data, prev));
                    if (!initialLoadDoneRef.current) {
                        setLoading(false);
                        initialLoadDoneRef.current = true;
                    }
                    if (data?.status === 'COMPLETED') {
                        if (data.result) {
                            setWinner(data.result);
                            return;
                        }
                        fetchWinnerByRoomId(roomId)
                            .then((latestWinner) => {
                                if (mountedRef.current) setWinner(latestWinner);
                            })
                            .catch(console.error);
                    }
                    console.log('[GamePage] WebSocket initial sync:', data);
                })
                .catch(console.error);
            try {
                const sessionSub = client.subscribe(`/topic/session/${roomId}`, (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        console.log('[GamePage] Session message received:', payload);
                        if (!mountedRef.current) return;
                        if (!initialLoadDoneRef.current) {
                            setLoading(false);
                            initialLoadDoneRef.current = true;
                        }
                        if (payload.status === 'COMPLETED' && payload.result) {
                            // 1. Сразу обновляем комнату (боты мгновенно появляются в списке участников)
                            setRoom((prev) => mergeStableRoomState(normalizeSessionMessage(payload, prev), prev));

                            // 2. Сбрасываем старые таймеры, если были
                            countdownTimersRef.current.forEach(clearTimeout);
                            countdownTimersRef.current = [];



                            // 3. Запускаем визуальную секвенцию: 3..2..1 -> Анимация -> Победитель
                            setShowCountdown(true);
                            setCountdownValue(3);
                            setShowAnimation(false);
                            setCurrentAnimationComponent(null);
                            const animationTheme = getVisualGameTheme(
                                payload.theme ?? roomSnapshotRef.current?.theme,
                                payload.participants ?? roomSnapshotRef.current?.participants,
                            );
                            const animationDuration = getAnimationDuration(animationTheme);
                            // console.log(room.theme.slice(0,-2))
                            const timers = [];
                            timers.push(setTimeout(() => { if (mountedRef.current) setCountdownValue(2); }, 1000));
                            timers.push(setTimeout(() => { if (mountedRef.current) setCountdownValue(1); }, 2000));
                            timers.push(setTimeout(() => {
                                if (mountedRef.current) {
                                    setShowCountdown(false);
                                    setCurrentAnimationComponent(() => getRandomAnimationComponent(animationTheme));
                                    setShowAnimation(true); // Запуск рулетки/анимации
                                }
                            }, 3000));
                            // console.log(room.theme.slice(0,-2))
                            timers.push(setTimeout(() => {
                                if (mountedRef.current) {
                                    setShowAnimation(false);
                                    setCurrentAnimationComponent(null);
                                    setWinner(normalizeRoundMessage(payload.result)); // Торжественный показ победителя
                                }
                            }, 3000 + animationDuration)); // 3 сек отсчет + 4 сек анимация

                            countdownTimersRef.current = timers;
                        } else {
                            setRoom((prev) => mergeStableRoomState(normalizeSessionMessage(payload, prev), prev));
                        }
                    } catch (e) {
                        console.error('[GamePage] Session message parse error:', e);
                    }
                });
                subscriptionsRef.current = [sessionSub];
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
    const handleActivateBoost = async (boostsCount) => {
        if (!user) return;
        setActionLoading(true);
        try {
            console.log('[GamePage] Activating boost...');
            await activateBoost(roomId, user.id, boostsCount);
            await refreshUser();
            setError(null);
            console.log('[GamePage] Boost activated successfully');
        } catch (err) {
            console.error('[GamePage] Boost activation failed:', err);
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };
    // console.log(room)

    // ===== Условные возвраты =====
    if (!isAuthenticated) return <div className="loading">Проверка авторизации...</div>;
    if (loading) return <div className="loading">Загрузка игры...</div>;
    if (error) return (
        <div className="error">
            Ошибка: {error}
            <button onClick={() => navigate('/lobby')}>Вернуться в лобби</button>
        </div>
    );
    if (!room) return <div className="error">Комната не найдена</div>;

    const participants = room.participants ?? [];
    const visualTheme = getVisualGameTheme(room.theme, participants);
    const maxPossibleUsers = participants.length + (room.maxSeats - room.currentParticipants);
    const isFinished = room.status === 'COMPLETED' && winner !== null;
    const isWaiting = !isFinished;
    const userIsParticipant = participants.some((p) => p.userId === user?.id);
    const currentUserParticipant = participants.find((p) => p.userId === user?.id) ?? null;
    const availableBoostsToBuy = currentUserParticipant ? (currentUserParticipant.seats - currentUserParticipant.boosts) : 0;

    const canActivateBoost =
        isWaiting &&
        userIsParticipant &&
        room.boostEnabled &&
        availableBoostsToBuy > 0 &&
        user?.balance >= (room.boostCost ?? 0);

    const winPercent = (() => {
        if (!userIsParticipant || !currentUserParticipant) return 0;

        const currentWeight = participants.reduce((sum, p) => {
            const normalSeats = p.seats - p.boosts;
            const boostedWeight = p.boosts * (room.boostWeightMultiplier || 1);
            return sum + normalSeats + boostedWeight;
        }, 0);

        const emptySeats = Math.max(0, room.maxSeats - (room.currentParticipants || 0));
        const totalRoomWeight = currentWeight + emptySeats;

        const myNormalSeats = currentUserParticipant.seats - currentUserParticipant.boosts;
        const myBoostedWeight = currentUserParticipant.boosts * (room.boostWeightMultiplier || 1);
        const myTotalWeight = myNormalSeats + myBoostedWeight;

        return totalRoomWeight > 0 ? Math.round((myTotalWeight / totalRoomWeight) * 100) : 0;
    })();


    return (
        <div className="game-page">
            <header className="game-header">
                <button className="back-button" onClick={() => navigate('/')}>❬</button>
                <div className="prize-pool">
                    призовой фонд: <strong>{room.currentPrizePool ?? 0}</strong>
                </div>
                <div className="header-actions">
                    <button className="profile-button" onClick={() => navigate('/account')}>профиль</button>
                </div>
            </header>

            <div className="game-main-row">
                <aside className="players-panel">
                    <h3>Участники: ({participants.length}/{maxPossibleUsers})</h3>
                    <ul className="players-list">
                        {participants.map((p, index) => (
                            <li key={p.userId ?? p.username + '-' + index} className={`player-item ${p.isBot ? 'bot' : 'human'}`}>
                                <span className="player-name">{p.username} <small style={{color: '#888'}}>(x{p.seats})</small></span>
                                {p.boosts > 0 && <span className="boost-indicator">⚡{p.boosts > 1 ? `x${p.boosts}` : ''}</span>}
                                {winner && winner.username === p.username && (
                                    <span className="winner-crown">🏆</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className={`game-area ${visualTheme}-${Math.min(participants.length, 7)}`}>
                    {showCountdown && (
                        <div className="countdown-overlay">
                            <div className="countdown-number">{countdownValue}</div>
                        </div>
                    )}

                    {showAnimation && (
                        <div className="animation-container" style={{ position: 'relative', zIndex: 10 }}>
                            {showAnimation && currentAnimationComponent && React.createElement(currentAnimationComponent)}
                        </div>
                    )}

                    {isWaiting && !showAnimation && !showCountdown && (
                        <div className="waiting-state">
                            {room.status === 'WAITING' ? (
                                <p className="timer" style={{ fontSize: '20px', maxWidth: '300px', textAlign: 'right' }}>
                                    Ожидание игроков.<br />Для начала розыгрыша нужно не менее {room.minSeatsToStart} мест.
                                </p>
                            ) : (
                                <p className="timer">До автозапуска: {displaySecondsLeft} сек.</p>
                            )}
                            {userIsParticipant && (
                                <>
                                    <div className="win-chance">
                                        Ваш шанс на победу: <strong>{winPercent}%</strong>
                                    </div>
                                    {room.boostEnabled && (
                                        <button
                                            className="boost-button"
                                            onClick={() => handleActivateBoost(1)}
                                            disabled={actionLoading || !canActivateBoost|| winPercent>=50}
                                        >
                                            {availableBoostsToBuy === 0
                                                ? 'Бусты активированы'
                                                : `Купить буст (${room.boostCost ?? 0})`}
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
                            <div className="game-visual-placeholder"></div>
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
