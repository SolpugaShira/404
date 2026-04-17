// src/context/UserContext.jsx (фрагмент)
import { createContext, useState, useContext, useEffect } from 'react';
import { connectSocket, disconnectSocket, socket } from '../socket';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    // Загружаем пользователя из localStorage или используем дефолтного
    const loadUser = () => {
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return { id: 'current-user-1', username: 'TestPlayer', balance: 1000 };
            }
        }
        return { id: 'current-user-1', username: 'TestPlayer', balance: 1000 };
    };

    const [user, setUser] = useState(loadUser);

    // Сохраняем в localStorage при изменении пользователя
    useEffect(() => {
        localStorage.setItem('currentUser', JSON.stringify(user));
    }, [user]);

    // Подключение сокета при наличии userId
    useEffect(() => {
        if (user.id) {
            connectSocket(user.id, user.username);
        }
        return () => {
            disconnectSocket();
        };
    }, [user.id, user.username]);

    // Слушаем обновление баланса от сервера
    useEffect(() => {
        const onBalanceUpdate = (newBalance) => {
            setUser(prev => ({ ...prev, balance: newBalance }));
        };
        socket.on('balance:update', onBalanceUpdate);
        return () => socket.off('balance:update', onBalanceUpdate);
    }, []);

    const updateBalance = (amount) => {
        setUser(prev => ({ ...prev, balance: prev.balance + amount }));
    };

    return (
        <UserContext.Provider value={{ user, setUser, updateBalance }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);