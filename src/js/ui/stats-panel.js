/* global gsap */

/**
 * Coin statistics panel with the 3D "odometer" number animation.
 * Persistence is delegated to the stats store.
 */
export function createStatsPanel({ store, headsContainer, tailsContainer, resetButton }) {
    const containers = { heads: headsContainer, tails: tailsContainer };

    const currentValueEl = (container) => {
        const all = container.querySelectorAll('.stats__value');
        return all[all.length - 1];
    };

    function renderInitial() {
        const { heads, tails } = store.get();
        currentValueEl(headsContainer).textContent = heads;
        currentValueEl(tailsContainer).textContent = tails;
    }

    /** Rolls the old value out and the new one in. */
    function animateNumber(container, value) {
        const outgoing = currentValueEl(container);

        const incoming = document.createElement('div');
        incoming.className = 'stats__value';
        incoming.textContent = value;
        gsap.set(incoming, { y: '100%', opacity: 0, rotationX: -80, scale: 0.8, transformStyle: 'preserve-3d' });
        container.appendChild(incoming);

        gsap.killTweensOf(outgoing);
        gsap.to(outgoing, {
            y: '-100%', opacity: 0, rotationX: 80, scale: 0.8,
            duration: 0.9, ease: 'expo.inOut',
            onComplete: () => outgoing.remove(),
        });
        gsap.to(incoming, {
            y: '0%', opacity: 1, rotationX: 0, scale: 1,
            duration: 0.9, ease: 'expo.inOut',
        });
    }

    resetButton.addEventListener('click', () => {
        store.reset();
        animateNumber(headsContainer, 0);
        animateNumber(tailsContainer, 0);
    });

    renderInitial();

    return {
        /** @param {'HEADS' | 'TAILS'} result */
        record(result) {
            const side = result === 'HEADS' ? 'heads' : result === 'TAILS' ? 'tails' : null;
            if (!side) return;
            store.increment(side);
            animateNumber(containers[side], store.get()[side]);
        },
    };
}
