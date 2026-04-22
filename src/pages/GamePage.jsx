// GamePage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
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
    const animationContainerRef = useRef(null);
    const countdownTimersRef = useRef([]);
    const countdownTriggeredRef = useRef(false); // флаг, что отсчёт уже запущен

    const roomSnapshotRef = useRef(null);
    const subscriptionsRef = useRef([]);
    const unsubscribeConnectionRef = useRef(null);
    const mountedRef = useRef(true);
    const initialLoadDoneRef = useRef(false);

    // Очистка при размонтировании
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            countdownTimersRef.current.forEach(clearTimeout);
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

    // Таймер обратного отсчёта (от сервера)
    useEffect(() => {
        if (!room || room.status === 'COMPLETED') {
            setDisplaySecondsLeft(0);
            return;
        }
        const calculateSecondsLeft = () => {
            if (!room.timerStartedAt) return Math.max(room.secondsLeft ?? 10, 10);
            const seconds = (-Date.now() + room.timerStartedAt) / 1000 + 10;
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

    // Проверка авторизации
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { replace: true, state: { from: `/game/${roomId}` } });
        }
    }, [isAuthenticated, navigate, roomId]);

    // Загрузка комнаты
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
                if (!client || !client.connected) return; // не пытаемся отписаться, если сокет закрыт
                if (typeof subscription.unsubscribe === 'function') {
                    subscription.unsubscribe();
                }
            } catch {}
        };
        const unsubscribeAll = () => {
            subscriptionsRef.current.forEach(safeUnsubscribe);
            subscriptionsRef.current = [];
        };
        const subscribeToTopics = (client) => {
            if (!client?.connected) return;
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
                })
                .catch(console.error);
            try {
                const sessionSub = client.subscribe(`/topic/session/${roomId}`, (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        if (!mountedRef.current) return;
                        if (!initialLoadDoneRef.current) {
                            setLoading(false);
                            initialLoadDoneRef.current = true;
                        }
                        if (payload.status === 'COMPLETED' && payload.result) {
                            setWinner(normalizeRoundMessage(payload.result));
                        }
                        setRoom((prev) => mergeStableRoomState(normalizeSessionMessage(payload, prev), prev));
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

    // Загрузка SVG-анимации
    const loadSvgAnimation = useCallback(async (theme) => {
        if (!animationContainerRef.current) return;
        try {
            const response = await fetch(`/assets/animations/${theme}.html`);
            console.log("Loaded animation, Loaded animation, Loaded animation, Loaded animation,");
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const svgElement = doc.querySelector('svg-animate');
            if (svgElement) {
                animationContainerRef.current.innerHTML = '';
                animationContainerRef.current.appendChild(svgElement);
            }
            if (window.Figmania && typeof window.Figmania.load === 'function') {
                window.Figmania.load(animationContainerRef.current);
            } else if (window.Figmania && typeof window.Figmania.observe === 'function') {
                // Альтернативный метод – наблюдение за новыми элементами
                window.Figmania.observe(animationContainerRef.current);
            }

        } catch (err) {
            console.error('Failed to load animation:', err);
        }
    }, []);

    // Эффект для обратного отсчёта (исправлен)
    useEffect(() => {
        if (!room) return;
        const isWaiting = room.status === 'WAITING' || room.status === 'FILLING';
        if (!isWaiting) return;

        // Запускаем только когда таймер <= 3 и ещё не запускали
        if (displaySecondsLeft <= 3 && displaySecondsLeft > 0 && !countdownTriggeredRef.current) {
            countdownTriggeredRef.current = true;

            // Очищаем предыдущие таймеры (на всякий случай)
            countdownTimersRef.current.forEach(clearTimeout);
            countdownTimersRef.current = [];

            setShowCountdown(true);
            setCountdownValue(3);
            setShowAnimation(false);

            const timers = [];
            timers.push(setTimeout(() => {
                if (mountedRef.current) setCountdownValue(2);
            }, 1000));
            timers.push(setTimeout(() => {
                if (mountedRef.current) setCountdownValue(1);
            }, 2000));
            timers.push(setTimeout(() => {
                if (mountedRef.current) {
                    setShowCountdown(false);
                    setShowAnimation(true);
                    const theme = room.theme ? `${room.theme.slice(0, -2)}G` : 'GOLFG';
                    loadSvgAnimation(theme);
                }
            }, 3000));
            countdownTimersRef.current = timers;
        }

        // Сбрасываем флаг, когда таймер снова становится > 3 (например, при новом раунде)
        if (displaySecondsLeft > 3) {
            countdownTriggeredRef.current = false;
        }
    }, [displaySecondsLeft, room, loadSvgAnimation]);

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
    const isWaiting = room.status === 'WAITING' || room.status === 'FILLING';
    const isFinished = room.status === 'COMPLETED';
    const userIsParticipant = participants.some((p) => p.userId === user?.id);
    const currentUserParticipant = participants.find((p) => p.userId === user?.id) ?? null;
    console.log();

    const canActivateBoost =
        isWaiting &&
        userIsParticipant &&
        room.boostEnabled &&
        !currentUserParticipant?.hasBoost &&
        user?.balance >= (room.boostCost ?? 0);
    if (currentUserParticipant){
        if (currentUserParticipant.hasBoost){
        currentUserParticipant.weight = room.boostWeightMultiplier;
        }   else{ currentUserParticipant.weight = 1}}

    const winPercent = (() => {
        if (!userIsParticipant || !currentUserParticipant) return 0;
        const mayWeight = participants.reduce((sum, p) => sum + (p.weight || 1), 0);
        const minWeight = room.maxSeats - participants.length;
        const totalWeight = minWeight + mayWeight;
        const userWeight = currentUserParticipant.weight || 1;
        // console.log(userWeight, totalWeight)
        return totalWeight > 0 ? Math.round((userWeight / totalWeight) * 100) : 0;
    })();

    const theme = `${room.theme?.slice(0, -2)}G` ?? "GOLFG";
    // console.log(participants)

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
                    <h3>Игроки ({participants.length}/{room.maxSeats})</h3>
                    <ul className="players-list">
                        {participants.map((p, index) => (
                            <li key={p.userId ?? p.username + '-' + index} className={`player-item ${p.isBot ? 'bot' : 'human'}`}>
                                <span className="player-name">{p.username}</span>
                                {p.hasBoost && <span className="boost-indicator">⚡</span>}
                                {winner && winner.username === p.username && (
                                    <span className="winner-crown">🏆</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className={`game-area ${theme}-${Math.min(participants.length, 5)}`}>
                    {showCountdown && (
                        <div className="countdown-overlay">
                            <div className="countdown-number">{countdownValue}</div>
                        </div>
                    )}

                    {showAnimation && (
                        <div className="animation-container" ref={animationContainerRef}></div>
                    )}

                    {isWaiting && !showAnimation && !showCountdown && (
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