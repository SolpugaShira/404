import { useEffect, useState } from 'react';
import { useUser } from '../context/useUser';

const formatDate = (value) => {
    if (!value) {
        return 'Недавно';
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

const emptyStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    winRate: 0,
    totalWinnings: 0,
    totalSpent: 0,
    totalBoostSpent: 0,
    biggestWin: 0,
    netProfit: 0,
    recentRounds: [],
    recentTransactions: [],
};

const formatTransactionAmount = (amount) => (amount >= 0 ? `+${amount}` : `${amount}`);

const AccountPage = () => {
    const { user, refreshUser } = useUser();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadProfile = async () => {
            setLoading(true);
            try {
                await refreshUser();
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to refresh profile:', error);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [user.id]);

    const stats = {
        ...emptyStats,
        ...(user.stats ?? {}),
        recentRounds: Array.isArray(user.stats?.recentRounds) ? user.stats.recentRounds : [],
        recentTransactions: Array.isArray(user.stats?.recentTransactions) ? user.stats.recentTransactions : [],
    };

    const statCards = [
        { label: 'Сыграно', value: stats.gamesPlayed },
        { label: 'Побед', value: stats.gamesWon },
        { label: 'Win rate', value: `${stats.winRate}%` },
        { label: 'Лучший выигрыш', value: stats.biggestWin },
        { label: 'Всего выиграно', value: stats.totalWinnings }
    ];

    return (
        <div className="account-page">
            <section className="page-heading">
                <div>
                    <h1>{user.username}</h1>
                    <p>Статистика строится по завершённым играм и финансовым операциям пользователя.</p>
                </div>
            </section>

            <section className="profile-hero">
                <div className="profile">
                    <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
                    <div>
                        <h2>{user.username}</h2>
                        <p>ID: {user.id}</p>
                    </div>
                </div>
                <div className="profile-summary">
                    <div>
                        <span>Потрачено</span>
                        <strong>{stats.totalSpent}</strong>
                    </div>
                    <div>
                        <span>На бусты</span>
                        <strong>{stats.totalBoostSpent}</strong>
                    </div>
                    <div>
                        <span>Текущий баланс</span>
                        <strong>{user.balance}</strong>
                    </div>
                </div>
            </section>

            <section className="stats-grid">
                {statCards.map((card) => (
                    <article key={card.label} className="stat-card">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                    </article>
                ))}
            </section>

            <section className="history-panel">
                <div className="history-panel__head">
                    <h2>Последние игры</h2>
                    <button type="button" onClick={() => refreshUser()}>
                        Обновить
                    </button>
                </div>
                {stats.recentRounds.length === 0 ? (
                    <p className="hint">Завершённых игр пока нет.</p>
                ) : (
                    <div className="history-list">
                        {stats.recentRounds.map((round) => (
                            <article key={round.roundId} className="history-item">
                                <div>
                                    <div className={`history-item__result ${round.won ? 'won' : 'lost'}`}>
                                        {round.won ? 'Победа' : 'Поражение'}
                                    </div>
                                    <p>Игра {round.roundId.slice(0, 8)}</p>
                                </div>
                                <div>
                                    <span>Комбинация</span>
                                    <strong>{round.winningCombination || 'Нет данных'}</strong>
                                </div>
                                <div>
                                    <span>Финансы</span>
                                    <strong>{round.won ? `+${round.prizeAmount}` : `-${round.spentAmount}`}</strong>
                                </div>
                                <div>
                                    <span>Дата</span>
                                    <strong>{formatDate(round.completedAt)}</strong>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="history-panel">
                <div className="history-panel__head">
                    <h2>Последние транзакции</h2>
                    <button type="button" onClick={() => refreshUser()}>
                        Обновить
                    </button>
                </div>
                {stats.recentTransactions.length === 0 ? (
                    <p className="hint">Транзакций пока нет.</p>
                ) : (
                    <div className="history-list">
                        {stats.recentTransactions.map((transaction) => (
                            <article key={transaction.id} className="history-item">
                                <div>
                                    <div className={`history-item__result ${transaction.amount >= 0 ? 'won' : 'lost'}`}>
                                        {transaction.type}
                                    </div>
                                    <p>{transaction.description}</p>
                                </div>
                                <div>
                                    <span>Сумма</span>
                                    <strong>{formatTransactionAmount(transaction.amount)}</strong>
                                </div>
                                <div>
                                    <span>Дата</span>
                                    <strong>{formatDate(transaction.createdAt)}</strong>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default AccountPage;
