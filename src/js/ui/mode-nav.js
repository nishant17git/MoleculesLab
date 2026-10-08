/** COIN / YES-NO switcher. State lives in `data-mode` on the root so CSS can style from it. */
export function createModeNav(root, { onSelect }) {
    const tabs = Array.from(root.querySelectorAll('[data-select]'));

    function setActive(mode) {
        root.dataset.mode = mode;
        tabs.forEach((tab) => {
            const active = tab.dataset.select === mode;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-pressed', String(active));
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => onSelect(tab.dataset.select));
    });

    return { setActive };
}
