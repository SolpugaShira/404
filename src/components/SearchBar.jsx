const SearchBar = ({ value, onChange }) => {
    return (
        <div className="search-bar">
            <input
                type="text"
                placeholder="Поиск комнаты по названию, описанию или id"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
};

export default SearchBar;
