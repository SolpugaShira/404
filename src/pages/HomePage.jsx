import { useEffect, useMemo, useState } from 'react';
import RoomCard from '../components/RoomCard';
import SearchBar from '../components/SearchBar';
import HorizontalScrollSection from '../components/HorizontalScrollSection';
import { fetchRooms, normalizeRoomSummary, normalizeRoomsMessage, normalizeSessionMessage } from '../api/roomsApi';
import { getStompClient, onStompConnectionChange } from '../stompClient';

const HomePage = () => {
    const [rooms, setRooms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadRooms = async () => {
            try {
                const data = await fetchRooms();
                if (!cancelled) {
                    setRooms(data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load rooms:', error);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadRooms();

        const subscribeToRooms = (client) => {
            if (!client?.connected) return undefined;
            const destination = '/topic/rooms';
            console.log(`[WS][SUBSCRIBE] ${destination}`);
            return client.subscribe(destination, (message) => {
                console.log(`[WS][MESSAGE] ${destination}`, message.body);
                try {
                    const payload = JSON.parse(message.body);
                    const updatedRooms = Array.isArray(payload)
                        ? normalizeRoomsMessage(payload)
                        : [normalizeRoomSummary(payload)];

                    setRooms((prevRooms) => {
                        const roomsById = new Map(prevRooms.map((room) => [room.id, room]));
                        updatedRooms.forEach((updatedRoom) => {
                            roomsById.set(updatedRoom.id, {
                                ...roomsById.get(updatedRoom.id),
                                ...updatedRoom,
                            });
                        });
                        return Array.from(roomsById.values());
                    });
                } catch (error) {
                    console.error('Rooms parse error:', error);
                }
            });
        };

        const safeUnsubscribe = (sub) => {
            try {
                if (typeof sub?.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            } catch {
                // Игнорируем ошибки уже закрытого сокета
            }
        };

        let subscription = subscribeToRooms(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            if (subscription) {
                console.log('[WS][UNSUBSCRIBE] /topic/rooms');
            }
            safeUnsubscribe(subscription);
            subscription = subscribeToRooms(client);
        });

        return () => {
            cancelled = true;
            if (subscription) {
                console.log('[WS][UNSUBSCRIBE] /topic/rooms');
            }
            safeUnsubscribe(subscription);
            unsubscribeConnection();
        };
    }, []);

    const roomIds = useMemo(
        () => rooms.map((room) => room.roomId ?? room.id).filter(Boolean).sort(),
        [rooms],
    );
    const roomIdsKey = roomIds.join('|');

    useEffect(() => {
        const sessionRoomIds = roomIdsKey ? roomIdsKey.split('|') : [];
        if (sessionRoomIds.length === 0) return undefined;

        const safeUnsubscribe = (sub) => {
            try {
                if (typeof sub?.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            } catch {
                return;
            }
        };

        const subscribeToRoomSessions = (client) => {
            if (!client?.connected) return [];
            return sessionRoomIds.map((id) => {
                const destination = `/topic/session/${id}`;
                console.log(`[WS][SUBSCRIBE] ${destination}`);
                return client.subscribe(destination, (message) => {
                    console.log(`[WS][MESSAGE] ${destination}`, message.body);
                    try {
                        const payload = JSON.parse(message.body);
                        setRooms((prevRooms) => prevRooms.map((room) => {
                            const sameRoom = room.id === id || room.roomId === id;
                            return sameRoom ? normalizeSessionMessage(payload, room) : room;
                        }));
                    } catch (error) {
                        console.error('Room session parse error:', error);
                    }
                });
            });
        };

        let subscriptions = subscribeToRoomSessions(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            subscriptions.forEach(safeUnsubscribe);
            subscriptions = subscribeToRoomSessions(client);
        });

        return () => {
            subscriptions.forEach(safeUnsubscribe);
            if (typeof unsubscribeConnection === 'function') {
                unsubscribeConnection();
            }
        };
    }, [roomIdsKey]);

    // Фильтрация по поиску (общая для всех категорий)
    const filteredBySearch = rooms.filter((room) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            room.id?.toLowerCase().includes(searchLower) ||
            room.name?.toLowerCase().includes(searchLower) ||
            room.description?.toLowerCase().includes(searchLower)
        );
    });

    // Определение категорий
    const getGameType = (theme) => {
        if (!theme) return null;
        // theme имеет вид "GOLF-1", "TENNIS-2", "RACING-3" – убираем последние два символа (дефис и цифру)
        const base = theme.slice(0, -2);
        if (base === 'GOLF' || base === 'TENNIS' || base === 'RACING') {
            return base;
        }
        return null;
    };

    // Категория "Популярное" – все отфильтрованные комнаты
    const popularRooms = filteredBySearch;

    // Категория "Большой выигрыш" – все отфильтрованные комнаты, сортировка по currentPrizePool (по убыванию)
    const bigWinRooms = [...filteredBySearch].sort((a, b) => {
        const prizeA = a.currentPrizePool ?? 0;
        const prizeB = b.currentPrizePool ?? 0;
        return prizeB - prizeA;
    });

    // Категории по типам игр
    const golfRooms = filteredBySearch.filter(room => getGameType(room.theme) === 'GOLF');
    const tennisRooms = filteredBySearch.filter(room => getGameType(room.theme) === 'TENNIS');
    const racingRooms = filteredBySearch.filter(room => getGameType(room.theme) === 'RACING');

    return (
        <div className="home-page">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />

            {loading ? (
                <div className="loading">Загрузка комнат...</div>
            ) : (
                <>
                    <HorizontalScrollSection
                        title="Популярное"
                        items={popularRooms}
                        renderItem={(room) => <RoomCard room={room} />}
                        emptyMessage="Нет доступных комнат"
                    />

                    <HorizontalScrollSection
                        title="Большой выигрыш"
                        items={bigWinRooms}
                        renderItem={(room) => <RoomCard room={room} />}
                        emptyMessage="Нет комнат с крупным призовым фондом"
                    />

                    <HorizontalScrollSection
                        title="Гольф"
                        items={golfRooms}
                        renderItem={(room) => <RoomCard room={room} />}
                        emptyMessage="Нет активных комнат для гольфа"
                    />

                    <HorizontalScrollSection
                        title="Теннис"
                        items={tennisRooms}
                        renderItem={(room) => <RoomCard room={room} />}
                        emptyMessage="Нет активных комнат для тенниса"
                    />

                    <HorizontalScrollSection
                        title="Гонки"
                        items={racingRooms}
                        renderItem={(room) => <RoomCard room={room} />}
                        emptyMessage="Нет активных комнат для гонок"
                    />
                </>
            )}
        </div>
    );
};

export default HomePage;
