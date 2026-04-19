import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { fetchServerRoot, HTTP_BASE_URL_LABEL } from '../api/http';
import filtr from '../assets/Icon.svg';

const SearchBar = ({ value, onChange }) => {
    const { user, logoutUser } = useUser();
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
            <Link to="/account" style={{color:'black', }}>профиль</Link></nav>
        </div>
    );
};

export default SearchBar;
