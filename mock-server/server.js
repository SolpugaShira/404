// mock-server/server.js
const { Server } = require('socket.io');
const { users, initialRooms } = require('./mockData');

const PORT = 3001;
const INACTIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут для удаления неактивных waiting комнат
const COMMISSION_RATE = 0.1;
const BOT_JOIN_DELAY_MS = 30000; // 30 секунд бездействия
const FINISHED_ROOM_CLEANUP_INTERVAL = 5000; // 5 секунд
const BOT_ADD_INTERVAL = 10000; // 10 секунд
const TARGET_ROOMS_COUNT = 8;

// Глобальное состояние
let rooms = JSON.parse(JSON.stringify(initialRooms));
let userBalances = { ...users };

const io = new Server(PORT, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// --- Вспомогательные функции ---
const generateNewRoom = () => {
    const id = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const maxSeats = Math.floor(Math.random() * 4) + 2;
    return {
        id,
        maxSeats,
        entryFee: Math.floor(Math.random() * 50 + 10),
        status: 'waiting',
        participants: [],
        lastActivity: Date.now(),
    };
};

const botNames = ['BotAlpha', 'BotBeta', 'BotGamma', 'BotDelta', 'BotEpsilon', 'BotZeta', 'BotEta', 'BotTheta'];
const generateBotName = () => botNames[Math.floor(Math.random() * botNames.length)] + '_' + Math.floor(Math.random() * 1000);

// Запуск игры (автоматический или ручной)
const startGameAutomatically = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return false;
    if (room.status !== 'waiting') return false;
    if (room.participants.length < 2) return false; // на всякий случай

    // Случайный победитель
    const winner = room.participants[Math.floor(Math.random() * room.participants.length)];
    room.status = 'finished';
    room.winner = winner;
    room.lastActivity = Date.now();

    const totalPot = room.participants.length * room.entryFee;
    const prize = Math.floor(totalPot * (1 - COMMISSION_RATE));

    // Начисление выигрыша победителю (если не бот)
    if (!winner.isBot) {
        updateUserBalance(winner.userId, prize);
        const winnerSockets = getSocketsByUserId(winner.userId);
        winnerSockets.forEach(s => emitBalanceUpdate(s, winner.userId));
    }

    console.log(`🏆 [AUTO] Игра в комнате ${roomId} завершена. Победитель: ${winner.username}, выигрыш: ${prize}`);

    // Оповещаем всех в комнате и обновляем общий список
    io.to(roomId).emit('room:update', room);
    io.emit('rooms:list', rooms);

    return true;
};

// Добавление бота в комнату (возвращает true, если бот добавлен)
const addBotToRoom = (room) => {
    if (room.status !== 'waiting') return false;
    if (room.participants.length >= room.maxSeats) return false;

    const botId = `bot-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const bot = {
        userId: botId,
        username: generateBotName(),
        isBot: true,
        hasBoost: Math.random() > 0.7,
    };
    room.participants.push(bot);
    room.lastActivity = Date.now();
    console.log(`🤖 Бот ${bot.username} добавлен в комнату ${room.id}`);
    return true;
};

// Удаление завершённых комнат и пополнение до TARGET_ROOMS_COUNT
const cleanupFinishedRoomsAndRefill = () => {
    let changed = false;
    rooms = rooms.filter(room => {
        if (room.status === 'finished') {
            console.log(`🧹 Удалена завершённая комната ${room.id}`);
            changed = true;
            return false;
        }
        return true;
    });

    while (rooms.length < TARGET_ROOMS_COUNT) {
        const newRoom = generateNewRoom();
        rooms.push(newRoom);
        console.log(`🆕 Создана новая комната ${newRoom.id}`);
        changed = true;
    }

    if (changed) {
        io.emit('rooms:list', rooms);
    }
};

// Добавление ботов в неактивные комнаты
const addBotsToInactiveRooms = () => {
    const now = Date.now();
    let listChanged = false;
    rooms.forEach(room => {
        if (room.status !== 'waiting') return;
        if (room.participants.length >= room.maxSeats) return;
        if (now - room.lastActivity > BOT_JOIN_DELAY_MS) {
            const added = addBotToRoom(room);
            if (added) {
                listChanged = true;
                io.to(room.id).emit('room:update', room);
                // Если комната заполнилась, запускаем игру
                if (room.participants.length === room.maxSeats) {
                    startGameAutomatically(room.id);
                }
            }
        }
    });
    if (listChanged) {
        io.emit('rooms:list', rooms);
    }
};

// --- Работа с балансами ---
const getUserBalance = (userId) => {
    if (!userBalances[userId]) {
        userBalances[userId] = { id: userId, username: `Player_${userId.slice(0,4)}`, balance: 1000 };
    }
    return userBalances[userId].balance;
};

const updateUserBalance = (userId, amount, username = null) => {
    if (!userBalances[userId]) {
        userBalances[userId] = { id: userId, username: username || `Player_${userId.slice(0,4)}`, balance: 1000 };
    }
    userBalances[userId].balance += amount;
    if (username) userBalances[userId].username = username;
    console.log(`💰 Баланс ${userId} изменён на ${amount}, текущий: ${userBalances[userId].balance}`);
    return userBalances[userId].balance;
};

const emitBalanceUpdate = (socket, userId) => {
    const balance = getUserBalance(userId);
    socket.emit('balance:update', balance);
};

const getSocketsByUserId = (userId) => {
    const sockets = [];
    for (const [id, socket] of io.sockets.sockets) {
        if (socket.handshake.auth.userId === userId) {
            sockets.push(socket);
        }
    }
    return sockets;
};

// --- Планировщики ---
setInterval(cleanupFinishedRoomsAndRefill, FINISHED_ROOM_CLEANUP_INTERVAL);
setInterval(addBotsToInactiveRooms, BOT_ADD_INTERVAL);

// --- Обработчики Socket.IO ---
io.on('connection', (socket) => {
    const { userId, userName } = socket.handshake.auth;
    console.log(`🔌 Подключился: ${userName || 'Anon'} (${userId}) socket: ${socket.id}`);

    if (userId) {
        emitBalanceUpdate(socket, userId);
    }

    socket.on('rooms:get', (callback) => {
        if (typeof callback === 'function') {
            callback(rooms);
        }
    });

    socket.on('room:get', ({ roomId }, callback) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return callback({ error: 'Комната не найдена' });
        callback(room);
    });

    socket.on('room:join', ({ roomId }, callback) => {
        if (!userId) return callback({ error: 'Не авторизован' });
        const room = rooms.find(r => r.id === roomId);
        if (!room) return callback({ error: 'Комната не найдена' });
        if (room.status !== 'waiting') return callback({ error: 'Комната недоступна' });
        if (room.participants.length >= room.maxSeats) return callback({ error: 'Нет свободных мест' });
        if (room.participants.some(p => p.userId === userId)) return callback({ error: 'Вы уже в этой комнате' });

        const currentBalance = getUserBalance(userId);
        if (currentBalance < room.entryFee) return callback({ error: 'Недостаточно средств' });

        updateUserBalance(userId, -room.entryFee, userName);
        emitBalanceUpdate(socket, userId);

        const newParticipant = {
            userId,
            username: userName || `Player_${userId}`,
            isBot: false,
            hasBoost: false,
        };
        room.participants.push(newParticipant);
        room.lastActivity = Date.now();

        socket.join(roomId);
        console.log(`➕ ${userName} вошёл в ${roomId}`);

        io.to(roomId).emit('room:update', room);
        io.emit('rooms:list', rooms);

        // ** АВТОМАТИЧЕСКИЙ СТАРТ ПРИ ЗАПОЛНЕНИИ **
        if (room.participants.length === room.maxSeats) {
            startGameAutomatically(roomId);
        }

        callback({ success: true, room });
    });

    socket.on('room:leave', ({ roomId }) => {
        if (!userId) return;
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        const index = room.participants.findIndex(p => p.userId === userId);
        if (index === -1) return;

        if (room.status === 'waiting') {
            updateUserBalance(userId, room.entryFee);
            const userSockets = getSocketsByUserId(userId);
            userSockets.forEach(s => emitBalanceUpdate(s, userId));
            console.log(`↩️ Возврат ставки ${userId}`);
        }

        room.participants.splice(index, 1);
        room.lastActivity = Date.now();
        socket.leave(roomId);

        io.to(roomId).emit('room:update', room);
        io.emit('rooms:list', rooms);
        console.log(`🚪 ${userId} покинул ${roomId}`);
    });

    socket.on('room:start', ({ roomId }, callback) => {
        // Ручной запуск остаётся для совместимости, но теперь можно и автоматически
        if (!userId) return callback({ error: 'Не авторизован' });
        const room = rooms.find(r => r.id === roomId);
        if (!room) return callback({ error: 'Комната не найдена' });
        if (room.status !== 'waiting') return callback({ error: 'Игра уже начата или завершена' });
        if (room.participants.length < 2) return callback({ error: 'Недостаточно игроков' });
        if (!room.participants.some(p => p.userId === userId)) return callback({ error: 'Вы не в этой комнате' });

        const success = startGameAutomatically(roomId);
        if (!success) return callback({ error: 'Не удалось запустить игру' });

        const updatedRoom = rooms.find(r => r.id === roomId);
        callback({ success: true, winner: updatedRoom.winner, prize: updatedRoom.prize });
    });

    socket.on('disconnect', () => {
        console.log(`❌ Отключился: ${userId} socket: ${socket.id}`);
        // Не удаляем участника автоматически
    });
});

console.log(`🚀 Сервер запущен на порту ${PORT}`);