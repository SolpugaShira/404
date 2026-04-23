import { useRef, useState, useEffect } from 'react';

const HorizontalScrollSection = ({ title, items, renderItem, emptyMessage = 'Нет комнат' }) => {
    const containerRef = useRef(null);
    const dragStateRef = useRef({
        active: false,
        dragged: false,
        startX: 0,
        scrollLeft: 0,
    });
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

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
            behavior: 'smooth',
        });
        setTimeout(updateScrollButtons, 300);
    };

    const handleMouseDown = (event) => {
        if (event.button !== 0) return;
        const container = containerRef.current;
        if (!container) return;

        dragStateRef.current = {
            active: true,
            dragged: false,
            startX: event.clientX,
            scrollLeft: container.scrollLeft,
        };
    };

    const handleMouseMove = (event) => {
        const container = containerRef.current;
        const dragState = dragStateRef.current;
        if (!container || !dragState.active) return;

        const deltaX = event.clientX - dragState.startX;
        if (Math.abs(deltaX) > 10) {
            dragState.dragged = true;
            setIsDragging(true);
        }

        if (dragState.dragged) {
            event.preventDefault();
            container.scrollLeft = dragState.scrollLeft - deltaX;
            updateScrollButtons();
        }
    };

    const stopDragging = () => {
        const dragState = dragStateRef.current;
        dragState.active = false;
        setTimeout(() => {
            dragState.dragged = false;
            setIsDragging(false);
        }, 0);
    };

    const handleClickCapture = (event) => {
        if (!dragStateRef.current.dragged) return;
        event.preventDefault();
        event.stopPropagation();
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
                    ‹
                </button>
                <div
                    className={`scroll-container ${isDragging ? 'is-dragging' : ''}`}
                    ref={containerRef}
                    onScroll={updateScrollButtons}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDragging}
                    onMouseLeave={stopDragging}
                    onClickCapture={handleClickCapture}
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
                    ›
                </button>
            </div>
        </div>
    );
};

export default HorizontalScrollSection;
