// mock-server/mockData.js

// Тестовые пользователи с начальным балансом
const users = {
    'current-user-1': {
        id: 'current-user-1',
        username: 'TestPlayer',
        balance: 1000,
    },
    'user-2': {
        id: 'user-2',
        username: 'Bob',
        balance: 500,
    },
    'user-3': {
        id: 'user-3',
        username: 'Alice',
        balance: 800,
    },
    'user-4': {
        id: 'user-4',
        username: 'Charlie',
        balance: 300,
    },
};

// Начальные комнаты
const initialRooms = [
    {
        id: 'room-1',
        maxSeats: 3,
        entryFee: 10,
        status: 'waiting',
        participants: [
            { userId: 'user-1', username: 'Alice', isBot: false, hasBoost: false },
        ],
        lastActivity: Date.now() - 2 * 60 * 1000, // 2 минуты назад
    },
    {
        id: 'room-2',
        maxSeats: 4,
        entryFee: 25,
        status: 'waiting',
        participants: [
            { userId: 'bot-1', username: 'BotMike', isBot: true, hasBoost: true },
            { userId: 'user-2', username: 'Bob', isBot: false, hasBoost: false },
        ],
        lastActivity: Date.now() - 7 * 60 * 1000, // 7 минут назад (будет удалена)
    },
    {
        id: 'room-3',
        maxSeats: 2,
        entryFee: 50,
        status: 'in_progress',
        participants: [
            { userId: 'user-3', username: 'Charlie', isBot: false, hasBoost: false },
            { userId: 'user-4', username: 'Dave', isBot: false, hasBoost: true },
        ],
        lastActivity: Date.now() - 1 * 60 * 1000,
    },
];

// Добавим ещё 5 пустых комнат для наполнения
for (let i = 4; i <= 8; i++) {
    initialRooms.push({
        id: `room-${i}`,
        maxSeats: Math.floor(Math.random() * 4) + 2,
        entryFee: Math.floor(Math.random() * 50 + 10),
        status: 'waiting',
        participants: [],
        lastActivity: Date.now() - Math.floor(Math.random() * 10) * 60 * 1000,
    });
}

module.exports = { users, initialRooms };