// Имитация состояния сервера: комнаты и баланс пользователя
export const mockUser = {
    userId: 'user-123',
    username: 'TestPlayer',
    balance: 1000,
};

const now = Date.now();

export const initialRooms = [
    {
        id: 'room-1',
        maxSeats: 4,
        entryFee: 50,
        status: 'waiting',
        participants: [
            { userId: 'user-101', username: 'Alice', isBot: false, hasBoost: false },
            { userId: 'user-102', username: 'Bob', isBot: false, hasBoost: true },
        ],
        timerStartedAt: now - 20000, // 20 sec ago
        lastActivity: now - 20000,
    },
    {
        id: 'room-2',
        maxSeats: 2,
        entryFee: 100,
        status: 'waiting',
        participants: [
            { userId: 'user-103', username: 'Bot1', isBot: true, hasBoost: false },
        ],
        timerStartedAt: now - 60000 * 6, // 6 min ago (неактивная)
        lastActivity: now - 60000 * 6,
    },
    {
        id: 'room-3',
        maxSeats: 3,
        entryFee: 30,
        status: 'in_progress',
        participants: [
            { userId: 'user-104', username: 'Charlie', isBot: false, hasBoost: true },
            { userId: 'user-105', username: 'Bot2', isBot: true, hasBoost: false },
        ],
        timerStartedAt: now - 30000,
        lastActivity: now - 30000,
    },
    {
        id: 'room-4',
        maxSeats: 5,
        entryFee: 20,
        status: 'finished',
        participants: [
            { userId: 'user-106', username: 'Dave', isBot: false, hasBoost: false },
        ],
        timerStartedAt: now - 120000,
        lastActivity: now - 120000,
        winner: { userId: 'user-106', username: 'Dave', isBot: false, hasBoost: false },
    },
];