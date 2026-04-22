import { Link } from 'react-router-dom';
import user from '../assets/SVG/commonSVG/User.svg';

const RoomCard = ({ room }) => {
    const { id, name, maxSeats, entryFee, currentParticipants, status, theme } = room;
    const occupied = currentParticipants;
    const isWaiting = status === 'WAITING' || status === 'FILLING';
    // if (theme.slice(0,-2) === "golf"){}
    return (
        // <Link to={`/room/${room.id}`} className="room-card-link">
            <Link to={`/room/${room.id}/lobby`} className="room-card-link">
            <div className={`room-card ${!isWaiting ? 'disabled-room' : ''} ${theme ?? 'GOLF-1'} `}>
                <h3>{name}</h3>
                <div className="room-info">
                    <span style={{fontSize: '20px'}}>ВХОД: {entryFee}</span>

                    <div className={'Users'}>
                        <img src={user} alt={'Игроки:'}/>
                        <span>{occupied}/{maxSeats}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default RoomCard;
