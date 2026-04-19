import { useEffect, useState, useRef } from 'react';
import RoomCard from '../components/RoomCard';
import SearchBar from '../components/SearchBar';
import { fetchRooms, normalizeRoomsMessage } from '../api/roomsApi';
import { getStompClient, onStompConnectionChange } from '../stompClient';

const HomePage = () => {
    const [rooms, setRooms] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Проверка положения скролла для отображения кнопок
    const updateScrollButtons = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        setShowLeftArrow(scrollLeft > 5);
        setShowRightArrow(scrollLeft < maxScrollLeft - 5);
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
            // Обновим состояние кнопок после анимации (setTimeout)
            setTimeout(updateScrollButtons, 300);
        }
    };

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
            setTimeout(updateScrollButtons, 300);
        }
    };

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

    // При обновлении комнат или загрузке перепроверяем кнопки
    useEffect(() => {
        if (!loading) {
            updateScrollButtons();
        }
    }, [rooms, loading]);

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
                </div>
                <div className="heading-chip">{rooms.length} активных комнат</div>
            </section>
            <SearchBar value={searchTerm} onChange={setSearchTerm} />

            {loading ? (
                <div className="loading">Загрузка комнат...</div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Кнопки прокрутки */}
                    {showLeftArrow && (
                        <button
                            className="scroll-btn scroll-btn-left"
                            onClick={scrollLeft}
                            aria-label="Прокрутить влево"
                        >
                            ◀
                        </button>
                    )}
                    {showRightArrow && (
                        <button
                            className="scroll-btn scroll-btn-right"
                            onClick={scrollRight}
                            aria-label="Прокрутить вправо"
                        >
                            ▶
                        </button>
                    )}

                    {/* Горизонтальный контейнер */}
                    <div
                        className="rooms-grid-horizontal"
                        ref={scrollContainerRef}
                        onScroll={updateScrollButtons}
                        style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '20px',
                            padding: '16px 8px',
                            scrollBehavior: 'smooth',
                            // Скрываем стандартный скроллбар (опционально, но лучше оставить для доступности)
                            // scrollbarWidth: 'thin',
                        }}
                    >
                        {filteredRooms.map((room) => (
                            <div key={room.id} style={{ flex: '0 0 auto', width: '280px' }}>
                                <RoomCard room={room} />
                            </div>
                        ))}
                        {filteredRooms.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', width: '100%' }}>
                                Нет комнат, соответствующих поиску
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;