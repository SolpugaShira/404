import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import filtr from '../assets/SVG/commonSVG/Icon.svg';

const defaultFilters = {
    name: '',
    theme: '',
    maxSeats: '',
    minSeatsToStart: '',
    entryFee: '',
    prizePoolPercent: '',
    boostEnabled: '',
    boostCost: '',
    boostWeightMultiplier: '',
};

const numericFilters = [
    ['maxSeats', 'Мест'],
    ['minSeatsToStart', 'Мин. старт'],
    ['entryFee', 'Вход'],
    ['prizePoolPercent', 'Приз %'],
    ['boostCost', 'Буст'],
    ['boostWeightMultiplier', 'Множитель'],
];

const themeOptions = [
    ['TENNIS-1', 'Теннис 1'],
    ['TENNIS-2', 'Теннис 2'],
    ['TENNIS-3', 'Теннис 3'],
    ['GOLF-1', 'Гольф 1'],
    ['GOLF-2', 'Гольф 2'],
    ['GOLF-3', 'Гольф 3'],
    ['GOLF-4', 'Гольф 4'],
    ['GOLF-5', 'Гольф 5'],
    ['GOLF-6', 'Гольф 6'],
    ['GOLF-7', 'Гольф 7'],
    ['RACING-1', 'Гонки 1'],
    ['RACING-2', 'Гонки 2'],
    ['RACING-3', 'Гонки 3'],
    ['RACING-4', 'Гонки 4'],
];

const SearchBar = ({ value, onChange, filters = defaultFilters, onApplyFilters, onResetFilters, filtering = false }) => {
    const { user } = useUser();
    const [open, setOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState({ ...defaultFilters, ...filters });

    const updateFilter = (key, nextValue) => {
        setDraftFilters((prev) => ({ ...prev, [key]: nextValue }));
    };

    const applyFilters = () => {
        onApplyFilters?.(draftFilters);
        setOpen(false);
    };

    const resetFilters = () => {
        setDraftFilters(defaultFilters);
        onResetFilters?.();
        setOpen(false);
    };

    return (
        <div className="search-bar">
            <nav className="search-nav">
                <div className="search-input-wrap">
                    <input
                        type="text"
                        placeholder="Введите запрос ..."
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                    />
                    <button
                        type="button"
                        className="filter-toggle"
                        onClick={() => setOpen((prev) => !prev)}
                        aria-label="Фильтр комнат"
                        aria-expanded={open}
                    >
                        <img src={filtr} alt="" />
                    </button>
                </div>
                <div className="user-balance">бонусы: {user.balance}</div>
                <Link to="/account" style={{ color: 'black', padding: '0 0 0 20px' }}>профиль</Link>
            </nav>

            {open && (
                <div className="filter-panel">
                    <label>
                        Название
                        <input
                            type="text"
                            value={draftFilters.name}
                            onChange={(event) => updateFilter('name', event.target.value)}
                        />
                    </label>
                    <label>
                        Тема
                        <select value={draftFilters.theme} onChange={(event) => updateFilter('theme', event.target.value)}>
                            <option value="">Любая</option>
                            {themeOptions.map(([themeValue, label]) => (
                                <option key={themeValue} value={themeValue}>{label}</option>
                            ))}
                        </select>
                    </label>
                    {numericFilters.map(([key, label]) => (
                        <label key={key}>
                            {label}
                            <input
                                type="number"
                                min="0"
                                step={key === 'boostWeightMultiplier' ? '0.1' : '1'}
                                value={draftFilters[key]}
                                onChange={(event) => updateFilter(key, event.target.value)}
                            />
                        </label>
                    ))}
                    <label>
                        Бусты
                        <select value={draftFilters.boostEnabled} onChange={(event) => updateFilter('boostEnabled', event.target.value)}>
                            <option value="">Любые</option>
                            <option value="true">Включены</option>
                            <option value="false">Выключены</option>
                        </select>
                    </label>
                    <div className="filter-actions">
                        <button type="button" onClick={applyFilters} disabled={filtering}>
                            {filtering ? 'Фильтр...' : 'Применить'}
                        </button>
                        <button type="button" onClick={resetFilters} disabled={filtering}>
                            Сбросить
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
