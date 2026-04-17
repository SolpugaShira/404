import { useState, useEffect } from 'react';
import RoomCard from '../components/RoomCard';
import SearchBar from '../components/SearchBar';
import { fetchRooms } from '../api/roomsApi';

const HomePage = () => {
    const [rooms, setRooms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRooms = async () => {
            try {
                const data = await fetchRooms();
                setRooms(data);
            } catch (error) {
                console.error('Ошибка загрузки комнат:', error);
            } finally {
                setLoading(false);
            }
        };
        loadRooms();
    }, []);

    const filteredRooms = rooms.filter((room) => {
        // Поиск по ID комнаты или именам участников
        const searchLower = searchTerm.toLowerCase();
        return (
            room.id.toLowerCase().includes(searchLower) ||
            room.participants.some((p) =>
                p.username.toLowerCase().includes(searchLower)
            )
        );
    });

    return (
        <div className="home-page">
            <h1>Игровые комнаты</h1>
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