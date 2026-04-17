import { Link } from 'react-router-dom';

const RoomCard = ({ room }) => {
    const { id, maxSeats, entryFee, participants, status } = room;
    const occupied = participants.length;
    const isWaiting = status === 'waiting';

    return (
        <Link to={`/room/${id}`} className="room-card-link">
            <div className={`room-card ${!isWaiting ? 'disabled-room' : ''}`}>
                <h3>Комната {id.slice(-3)}</h3>
                <div className="room-info">
                    <span>👥 {occupied}/{maxSeats}</span>
                    <span>💰 {entryFee}</span>
                </div>
                <div className="room-status">{isWaiting ? '🟢 Ожидание' : '🔴 Завершена'}</div>
                <div className="participants-preview">
                    {participants.slice(0, 3).map((p) => (
                        <span key={p.userId} className="participant-badge">
              {p.isBot ? '🤖' : '👤'} {p.username}
            </span>
                    ))}
                    {participants.length > 3 && <span>+{participants.length - 3}</span>}
                </div>
            </div>
        </Link>
    );
};

export default RoomCard;