import { useState } from 'react';
import { useUser } from '../context/useUser';

const USERNAME_MIN_LENGTH = 3;


const AuthPage = () => {
    const { loginUser, registerUser } = useUser();
    const [mode, setMode] = useState('register');
    const [username, setUsername] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submitLabel = mode === 'register' ? 'Создать аккаунт' : 'Войти';
    const title = mode === 'register' ? 'Регистрация' : 'Вход';
    const description = mode === 'register'
        ? 'Создайте имя игрока, чтобы сохранить профиль и подключиться к комнатам.'
        : 'Введите имя игрока, чтобы продолжить с сохранённым профилем.';

    const handleSubmit = async (event) => {
        event.preventDefault();

        const trimmedUsername = username.trim();
        if (trimmedUsername.length < USERNAME_MIN_LENGTH) {
            setError(`Имя должно содержать минимум ${USERNAME_MIN_LENGTH} символа.`);
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            if (mode === 'register') {
                await registerUser(trimmedUsername);
            } else {
                await loginUser(trimmedUsername);
            }
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-shell">
            <div className="background-glow background-glow--one" />
            <div className="background-glow background-glow--two" />
            <section className="auth-card">
                <div className="eyebrow">Rooms And Games</div>
                <h1>{title}</h1>
                <p>{description}</p>

                <div className="auth-switcher">
                    <button
                        type="button"
                        className={mode === 'register' ? 'auth-switcher__tab active' : 'auth-switcher__tab'}
                        onClick={() => setMode('register')}
                    >
                        Регистрация
                    </button>
                    <button
                        type="button"
                        className={mode === 'login' ? 'auth-switcher__tab active' : 'auth-switcher__tab'}
                        onClick={() => setMode('login')}
                    >
                        Вход
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <label className="auth-form__field" htmlFor="username">
                        Имя игрока
                    </label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Например, sigma"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        disabled={submitting}
                    />

                    {error && <div className="error auth-form__error">{error}</div>}

                    <button type="submit" className="auth-form__submit" disabled={submitting}>
                        {submitting ? 'Подключение...' : submitLabel}
                    </button>
                </form>
            </section>
        </div>
    );
};

export default AuthPage;
