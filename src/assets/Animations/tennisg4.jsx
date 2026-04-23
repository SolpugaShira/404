import React, {useRef} from "react";

export const TENNIS3 = () => {
    const containerRef = useRef(null);

    const svgString = `
    <svg-animate trigger="visible">
    
    </svg-animate>
  `;


    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                position: 'relative',
                backgroundColor: '#86ab5d',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% auto',    /* ширина 100% от элемента, высота автоматически (как получится) */
                backgroundPosition: 'left top',   /* стартовая позиция (можно также "top left" или "start" – но left top надёжнее) */
                height: '100%',                    /* если нужна именно такая высота элемента – оставляем, иначе замени на auto */
                zIndex: '10',
                bottom: '30px'
            }}
            dangerouslySetInnerHTML={{ __html: svgString }}
        />
    );
};

export const TENNIS4 = () => {
    const containerRef = useRef(null);

    const svgString = `
    <svg-animate trigger="visible">
    
    </svg-animate>
  `;


    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                position: 'relative',
                backgroundColor: '#86ab5d',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% auto',    /* ширина 100% от элемента, высота автоматически (как получится) */
                backgroundPosition: 'left top',   /* стартовая позиция (можно также "top left" или "start" – но left top надёжнее) */
                height: '100%',                    /* если нужна именно такая высота элемента – оставляем, иначе замени на auto */
                zIndex: '10',
                bottom: '30px'
            }}
            dangerouslySetInnerHTML={{ __html: svgString }}
        />
    );
};
