import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext.jsx';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import RoomLobbyPage from "./pages/RoomLobbyPage.jsx";
import GamePage from "./pages/GamePage.jsx";

function App() {
    return (
        <BrowserRouter>
            <UserProvider>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<HomePage />} />
                        <Route path="room/:roomId/lobby" element={<RoomLobbyPage />} />
                        <Route path="/game/:roomId" element={<GamePage />} />
                        <Route path="account" element={<AccountPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Route>
                </Routes>
            </UserProvider>
        </BrowserRouter>
    );
}

export default App;
