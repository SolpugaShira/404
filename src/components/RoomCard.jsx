import { Link } from 'react-router-dom';

const RoomCard = ({ room }) => {
    const { id, name, maxSeats, entryFee, currentParticipants, status, currentPrizePool } = room;
    const occupied = currentParticipants;
    const isWaiting = status === 'WAITING' || status === 'FILLING';

    return (
        <Link to={`/room/${id}`} className="room-card-link">
            <div className={`room-card ${!isWaiting ? 'disabled-room' : ''}`}>
                <h3>{name}</h3>
                <div className="room-info">
                    <span>Игроки: {occupied}/{maxSeats}</span>
                    <span>Вход: {entryFee}</span>
                </div>
                <div className="room-status">{isWaiting ? 'Ожидание' : 'Завершена'}</div>
                <div className="participants-preview">
                    <span className="participant-badge">Призовой фонд: {currentPrizePool}</span>
                </div>
            </div>
        </Link>
    );
};

export default RoomCard;
