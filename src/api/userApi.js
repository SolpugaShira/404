import { request } from './http';

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

const authRequest = async (username) => {
    return request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
    });
};

export const login = async (username) => authRequest(username);

export const register = async (username) => authRequest(username);

export const fetchUser = async (userId) => {
    return request(`/api/v1/users/${userId}`, {
        method: 'GET',
    });
};

const asArray = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.content)) {
        return payload.content;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    return [];
};

const pickNumber = (source, keys, fallback = 0) => {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }

    return fallback;
};

const pickString = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return fallback;
};

const pickDate = (source, keys) => pickString(source, keys, null);

const inferWon = (game, userId) => {
    if (typeof game?.won === 'boolean') {
        return game.won;
    }

    if (typeof game?.isWinner === 'boolean') {
        return game.isWinner;
    }

    if (typeof game?.winner === 'boolean') {
        return game.winner;
    }

    if (game?.winnerId && userId) {
        return game.winnerId === userId;
    }

    if (typeof game?.result === 'string') {
        return ['WIN', 'WON', 'VICTORY', 'SUCCESS'].includes(game.result.toUpperCase());
    }

    if (typeof game?.status === 'string') {
        return ['WIN', 'WON', 'VICTORY'].includes(game.status.toUpperCase());
    }

    return pickNumber(game, ['prizeAmount', 'winAmount', 'winnings', 'rewardAmount'], 0) > 0;
};

const normalizeGame = (game, userId) => {
    const won = inferWon(game, userId);

    return {
        roundId: pickString(game, ['roundId', 'gameId', 'id', 'sessionId'], 'unknown-round'),
        won,
        winningCombination: pickString(game, ['winningCombination', 'combination', 'resultCombination']),
        prizeAmount: pickNumber(game, ['prizeAmount', 'winAmount', 'winnings', 'rewardAmount']),
        spentAmount: pickNumber(game, ['spentAmount', 'entryFee', 'betAmount', 'stakeAmount', 'buyInAmount']),
        completedAt: pickDate(game, ['completedAt', 'finishedAt', 'endedAt', 'createdAt', 'playedAt']),
    };
};

const normalizeTransaction = (transaction) => {
    const rawAmount = pickNumber(transaction, ['amount', 'value', 'sum', 'delta']);
    const type = pickString(transaction, ['type', 'transactionType', 'category'], 'UNKNOWN');

    return {
        id: pickString(transaction, ['id', 'transactionId'], `${type}-${pickDate(transaction, ['createdAt', 'timestamp', 'date']) ?? 'now'}`),
        type,
        amount: rawAmount,
        createdAt: pickDate(transaction, ['createdAt', 'timestamp', 'date', 'processedAt']),
        description: pickString(transaction, ['description', 'comment', 'label', 'title'], type),
    };
};

const buildStats = (games, transactions) => {
    const gamesPlayed = games.length;
    const gamesWon = games.filter((game) => game.won).length;
    const totalWinnings = transactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalSpent = transactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const totalBoostSpent = transactions
        .filter((transaction) => transaction.amount < 0 && transaction.type.toUpperCase().includes('BOOST'))
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const biggestWin = games.reduce((max, game) => Math.max(max, game.prizeAmount ?? 0), 0);
    const netProfit = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
        gamesPlayed,
        gamesWon,
        winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
        totalWinnings,
        totalSpent,
        totalBoostSpent,
        biggestWin,
        netProfit,
        recentRounds: [...games]
            .sort((left, right) => new Date(right.completedAt ?? 0) - new Date(left.completedAt ?? 0))
            .slice(0, 10),
        recentTransactions: [...transactions]
            .sort((left, right) => new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0))
            .slice(0, 10),
    };
};

const normalizeStats = (stats) => ({
    ...emptyStats,
    ...(stats ?? {}),
    recentRounds: Array.isArray(stats?.recentRounds) ? stats.recentRounds : [],
    recentTransactions: Array.isArray(stats?.recentTransactions) ? stats.recentTransactions : [],
});

export const fetchUserGames = async (userId) => {
    const payload = await request(`/api/v1/users/${userId}/games`, {
        method: 'GET',
    });

    return asArray(payload).map((game) => normalizeGame(game, userId));
};

export const fetchUserTransactions = async (userId) => {
    const payload = await request(`/api/v1/users/${userId}/transactions`, {
        method: 'GET',
    });

    return asArray(payload).map(normalizeTransaction);
};

export const fetchUserProfile = async (userId) => {
    const user = await fetchUser(userId);

    if (user?.stats) {
        return {
            ...user,
            stats: normalizeStats(user.stats),
        };
    }

    const [games, transactions] = await Promise.all([
        fetchUserGames(userId).catch(() => []),
        fetchUserTransactions(userId).catch(() => []),
    ]);

    return {
        ...user,
        stats: normalizeStats(buildStats(games, transactions)),
    };
};
