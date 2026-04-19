import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import filtr from '../assets/Icon.svg';

const SearchBar = ({ value, onChange }) => {
    const { user } = useUser();
    return (
        <div className="search-bar">
            <nav><input
                type="text"
                placeholder="Введите запрос ..."
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            <img  src={filtr} style = {{position: "relative", right: '80px'}}/>
            <div className="user-balance">бонусы: {user.balance}</div>
            <Link to="/account" style={{color:'black', padding:'0 0 0 20px' }}>профиль</Link></nav>
        </div>
    );
};

export default SearchBar;
