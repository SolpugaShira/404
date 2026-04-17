import { useUser } from '../context/UserContext';

const AccountPage = () => {
    const { user } = useUser();
    return (
        <div className="account-page">
            <h2>Личный кабинет</h2>
            <div className="profile">
                <div className="avatar">👤</div>
                <h3>{user.username}</h3>
                <p>Баланс: {user.balance} 🪙</p>
            </div>
            <div className="account-actions">
                <button disabled>📊 История игр (скоро)</button>
                <button disabled>⚙️ Настройки</button>
            </div>
        </div>
    );
};

export default AccountPage;;