import { Link } from 'react-router-dom';

const NotFoundPage = () => (
    <div>
        <h2>404 — Страница не найдена</h2>
        <Link to="/">Вернуться к играм</Link>
    </div>
);

export default NotFoundPage;