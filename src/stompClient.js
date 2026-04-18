import { Client } from '@stomp/stompjs';

const DEFAULT_SOCKET_URL = 'wss://sigma-ways.org/ws';

const resolveSocketUrl = () => {
    const rawSocketUrl = import.meta.env.VITE_WS_URL;

    if (rawSocketUrl) {
        return rawSocketUrl.startsWith('http')
            ? rawSocketUrl.replace(/^http/, 'ws')
            : rawSocketUrl;
    }

    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    return DEFAULT_SOCKET_URL;
};

const SOCKET_URL = resolveSocketUrl();

let stompClient = null;
let stompClientUserId = null;
const connectionListeners = new Set();

const notifyConnectionListeners = (client) => {
    connectionListeners.forEach((listener) => {
        try {
            listener(client);
        } catch (error) {
            console.error('STOMP listener error:', error);
        }
    });
};

export const connectStomp = (userId, userName, onConnected, onError) => {
    if (stompClient?.connected && stompClientUserId === userId) {
        onConnected?.(stompClient);
        return stompClient;
    }

    if (stompClient?.active && stompClientUserId === userId) {
        return stompClient;
    }

    if (stompClient && stompClientUserId !== userId) {
        stompClient.deactivate().catch((error) => {
            console.error('STOMP deactivate error:', error);
        });
        stompClient = null;
        stompClientUserId = null;
        notifyConnectionListeners(null);
    }

    const client = new Client({
        brokerURL: SOCKET_URL,
        connectHeaders: {
            userId,
            userName,
        },
        debug: (message) => console.log('[STOMP]', message),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
        stompClient = client;
        stompClientUserId = userId;
        notifyConnectionListeners(client);
        onConnected?.(client);
    };

    client.onStompError = (frame) => {
        console.error('STOMP error:', frame.headers.message, frame.body);
        onError?.(frame);
    };

    client.onWebSocketClose = () => {
        stompClient = null;
        stompClientUserId = null;
        notifyConnectionListeners(null);
    };

    stompClient = client;
    stompClientUserId = userId;
    client.activate();
    return client;
};

export const disconnectStomp = async () => {
    if (stompClient?.active) {
        await stompClient.deactivate();
    }

    stompClient = null;
    stompClientUserId = null;
    notifyConnectionListeners(null);
};

export const getStompClient = () => stompClient;

export const onStompConnectionChange = (listener) => {
    connectionListeners.add(listener);
    return () => {
        connectionListeners.delete(listener);
    };
};
