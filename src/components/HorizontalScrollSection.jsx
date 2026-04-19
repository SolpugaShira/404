import { useRef, useState, useEffect } from 'react';

const HorizontalScrollSection = ({ title, items, renderItem, emptyMessage = "Нет комнат" }) => {
    const containerRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const updateScrollButtons = () => {
        const container = containerRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        setCanScrollLeft(scrollLeft > 5);
        setCanScrollRight(scrollLeft < maxScrollLeft - 5);
    };

    const scroll = (direction) => {
        if (!containerRef.current) return;
        const scrollAmount = 300;
        containerRef.current.scrollBy({
            left: direction === 'right' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
        setTimeout(updateScrollButtons, 300);
    };

    useEffect(() => {
        updateScrollButtons();
        window.addEventListener('resize', updateScrollButtons);
        return () => window.removeEventListener('resize', updateScrollButtons);
    }, [items]);

    return (
        <div className="horizontal-section">
            <div className="section-header">
                <h2>{title}</h2>
            </div>
            <div className="scroll-wrapper">
                <button
                    className="scroll-btn scroll-btn-left"
                    onClick={() => scroll('left')}
                    disabled={!canScrollLeft}
                >
                    &lt;
                </button>
                <div
                    className="scroll-container"
                    ref={containerRef}
                    onScroll={updateScrollButtons}
                >
                    {items.length === 0 ? (
                        <div className="empty-message">{emptyMessage}</div>
                    ) : (
                        items.map((item, idx) => (
                            <div key={item.id || idx} className="scroll-item">
                                {renderItem(item)}
                            </div>
                        ))
                    )}
                </div>
                <button
                    className="scroll-btn scroll-btn-right"
                    onClick={() => scroll('right')}
                    disabled={!canScrollRight}
                >
                    &gt;
                </button>
            </div>
        </div>
    );
};

export default HorizontalScrollSection;