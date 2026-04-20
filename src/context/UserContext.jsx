import { useEffect, useState } from 'react';
import AuthPage from '../components/AuthPage';
import { fetchUserProfile, login, register } from '../api/userApi';
import { disconnectStomp } from '../stompClient';
import UserContext from './userContext';

const mapUserPayload = (payload) => ({
    id: payload.id,
    username: payload.username,
    balance: payload.balance ?? payload.bonusBalance ?? 0,
    stats: payload.stats ?? null,
});

export const UserProvider = ({ children }) => {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;

    const loadUser = () => {
        const saved = storage?.getItem('currentUser');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return null;
            }
        }

        return null;
    };

    const [user, setUser] = useState(loadUser);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (user?.id || user?.username) {
            storage?.setItem('currentUser', JSON.stringify(user));
            return;
        }

        storage?.removeItem('currentUser');
    }, [storage, user]);

    useEffect(() => {
        let cancelled = false;

        const syncUser = async () => {
            if (!user?.id && !user?.username) {
                setReady(true);
                return;
            }

            try {
                const resolvedUser = user.id
                    ? await fetchUserProfile(user.id).catch(() => login(user.username))
                    : await login(user.username);

                if (!cancelled) {
                    setUser(mapUserPayload(resolvedUser));
                }
            } catch (error) {
                console.error('Failed to initialize user:', error);
            } finally {
                if (!cancelled) {
                    setReady(true);
                }
            }
        };

        syncUser();

        return () => {
            cancelled = true;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateBalance = (amount) => {
        setUser((prev) => ({ ...prev, balance: prev.balance + amount }));
    };

    const authenticate = async (authAction, username) => {
        const normalizedUsername = username.trim();
        const payload = await authAction(normalizedUsername);
        const profile = payload?.id ? await fetchUserProfile(payload.id).catch(() => payload) : payload;
        const normalizedUser = mapUserPayload(profile);
        setUser(normalizedUser);
        setReady(true);
        return normalizedUser;
    };

    const loginUser = async (username) => authenticate(login, username);

    const registerUser = async (username) => authenticate(register, username);

    const logoutUser = async () => {
        await disconnectStomp();
        setUser(null);
        setReady(true);
    };

    const refreshUser = async () => {
        if (!user?.id) {
            return null;
        }

        const freshUser = await fetchUserProfile(user.id);
        const normalizedUser = mapUserPayload(freshUser);
        setUser((prev) => ({ ...prev, ...normalizedUser }));
        return normalizedUser;
    };

    if (!ready || !user?.id) {
        return (
            <UserContext.Provider value={{
                user,
                setUser,
                updateBalance,
                refreshUser,
                ready,
                isAuthenticated: Boolean(user?.id),
                loginUser,
                registerUser,
                logoutUser,
            }}
            >
                {ready ? <AuthPage /> : null}
            </UserContext.Provider>
        );
    }

    return (
        <UserContext.Provider value={{
            user,
            setUser,
            updateBalance,
            refreshUser,
            ready,
            isAuthenticated: true,
            loginUser,
            registerUser,
            logoutUser,
        }}
        >
            {children}
        </UserContext.Provider>
    );
};
