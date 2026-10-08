/* global gsap */

/** Big animated result word (HEADS / TAILS / YES / NO). Letters slide in and out of masks. */
export function createResultDisplay({ textEl, liveRegion }) {
    function splitIntoChars(text) {
        textEl.textContent = '';
        return Array.from(text).map((char) => {
            const mask = document.createElement('span');
            mask.className = 'result__char-mask';
            const inner = document.createElement('span');
            inner.className = 'result__char';
            inner.textContent = char;
            if (char === ' ') mask.style.width = '0.3em';
            mask.appendChild(inner);
            textEl.appendChild(mask);
            return inner;
        });
    }

    return {
        /** Animates the current word out. Resolves when it has gone. */
        hide() {
            const chars = textEl.querySelectorAll('.result__char');
            if (chars.length === 0) return Promise.resolve();
            return new Promise((resolve) => {
                gsap.to(chars, {
                    y: '-110%', rotationZ: -10, opacity: 0,
                    duration: 0.5, ease: 'expo.in', stagger: 0.02,
                    onComplete: resolve,
                });
            });
        },

        show(text) {
            const chars = splitIntoChars(text);
            if (liveRegion) liveRegion.textContent = text; // screen readers get the plain word
            gsap.fromTo(
                chars,
                { y: '110%', rotationZ: 15, scale: 0.9, opacity: 0 },
                { y: '0%', rotationZ: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.05 }
            );
        },
    };
}
