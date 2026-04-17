import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const Layout = () => {
    const { user } = useUser();
    return (
        <div className="app">
            <header>
                <nav>
                    <Link to="/">🎮 Комнаты</Link>
                    <Link to="/account">👤 Аккаунт</Link>
                </nav>
                <div className="user-balance">
                    💰 {user.balance} бонусов
                </div>
            </header>
            <main>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;