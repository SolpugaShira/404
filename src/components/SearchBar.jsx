const SearchBar = ({ value, onChange }) => {
    return (
        <div className="search-bar">
            <input
                type="text"
                placeholder="🔍 Поиск игры..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};

export default SearchBar;