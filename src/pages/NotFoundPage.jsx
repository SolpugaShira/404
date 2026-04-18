import { Link } from 'react-router-dom';

const NotFoundPage = () => (
    <div className="not-found-page">
        <h2>404: страница не найдена</h2>
        <Link to="/">Вернуться к комнатам</Link>
    </div>
);

export default NotFoundPage;
