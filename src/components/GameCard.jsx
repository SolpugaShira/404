import { Link } from 'react-router-dom';

const GameCard = ({ game }) => {
    const { id, title, description, icon, isPlayable } = game;

    const content = (
        <div className="game-card">
            <div className="game-icon">{icon}</div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );

    return isPlayable ? (
        <Link to={`/game/${id}`} className="game-link">
            {content}
        </Link>
    ) : (
        <div className="game-link disabled">{content}</div>
    );
};

export default GameCard;