import { useEffect, useState } from 'react';
import RoomCard from '../components/RoomCard';
import SearchBar from '../components/SearchBar';
import { fetchRooms, normalizeRoomsMessage } from '../api/roomsApi';
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
            if (!client?.connected) {
                return undefined;
            }

            return client.subscribe('/topic/rooms', (message) => {
                try {
                    setRooms(normalizeRoomsMessage(JSON.parse(message.body)));
                } catch (error) {
                    console.error('Rooms parse error:', error);
                }
            });
        };

        let subscription = subscribeToRooms(getStompClient());
        const unsubscribeConnection = onStompConnectionChange((client) => {
            subscription?.unsubscribe();
            subscription = subscribeToRooms(client);
        });

        return () => {
            cancelled = true;
            subscription?.unsubscribe();
            unsubscribeConnection();
        };
    }, []);

    const filteredRooms = rooms.filter((room) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            room.id.toLowerCase().includes(searchLower) ||
            room.name.toLowerCase().includes(searchLower) ||
            room.description.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="home-page">
            <section className="page-heading">
                <div>
                    <div className="eyebrow">Лобби</div>
                    <h1>Игровые комнаты</h1>
                    <p>После завершения игры стол исчезает из списка и моментально заменяется новым.</p>
                </div>
                <div className="heading-chip">{rooms.length} активных комнат</div>
            </section>
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
            {loading ? (
                <div className="loading">Загрузка комнат...</div>
            ) : (
                <div className="rooms-grid">
                    {filteredRooms.map((room) => (
                        <RoomCard key={room.id} room={room} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomePage;
