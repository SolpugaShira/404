// src/api/roomsApi.js
import { socket } from '../socket';

// Получить список всех комнат
export const fetchRooms = () => {
    return new Promise((resolve, reject) => {
        socket.emit('rooms:get', (response) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
};

// Получить комнату по ID
export const fetchRoomById = (roomId) => {
    return new Promise((resolve, reject) => {
        socket.emit('room:get', { roomId }, (response) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
};

// Присоединиться к комнате
export const joinRoom = (roomId) => {
    return new Promise((resolve, reject) => {
        socket.emit('room:join', { roomId }, (response) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response.room);
        });
    });
};

// Покинуть комнату
export const leaveRoom = (roomId) => {
    return new Promise((resolve) => {
        socket.emit('room:leave', { roomId });
        resolve();
    });
};

// Начать игру
export const startGame = (roomId) => {
    return new Promise((resolve, reject) => {
        socket.emit('room:start', { roomId }, (response) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
};