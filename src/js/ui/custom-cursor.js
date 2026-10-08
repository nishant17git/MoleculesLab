/* global gsap */
import { hasFinePointer } from '../utils/device.js';

/** Trailing dot cursor. Only runs for mouse/pen users — touch devices skip it entirely. */
export function initCustomCursor(element) {
    if (!element || typeof gsap === 'undefined' || !hasFinePointer()) return;

    gsap.set(element, { xPercent: -50, yPercent: -50 });
    const moveX = gsap.quickTo(element, 'x', { duration: 0.1, ease: 'power2.out' });
    const moveY = gsap.quickTo(element, 'y', { duration: 0.1, ease: 'power2.out' });

    window.addEventListener(
        'pointermove',
        (event) => {
            if (event.pointerType === 'touch') return;
            element.classList.add('is-active');
            moveX(event.clientX);
            moveY(event.clientY);
        },
        { passive: true }
    );
}
