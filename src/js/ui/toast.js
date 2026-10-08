import { PWA } from '../config.js';

/**
 * A single, quiet status pill (connection changes, offline-ready, update available).
 * One element is reused for every message; a new message replaces the previous one.
 */
export function createToast(root) {
    const textEl = root.querySelector('.toast__text');
    const actionEl = root.querySelector('.toast__action');
    let timer = 0;
    let onAction = null;

    function hide() {
        clearTimeout(timer);
        root.classList.remove('is-visible');
    }

    function show(message, { tone = 'neutral', duration = PWA.toastMs, actionLabel, onAction: handler } = {}) {
        clearTimeout(timer);
        textEl.textContent = message;
        root.dataset.tone = tone;

        const hasAction = Boolean(actionLabel);
        actionEl.hidden = !hasAction;
        actionEl.textContent = hasAction ? actionLabel : '';
        onAction = hasAction ? handler : null;
        root.classList.toggle('has-action', hasAction);

        root.classList.add('is-visible');
        if (duration > 0) timer = setTimeout(hide, duration);
    }

    actionEl.addEventListener('click', () => {
        const handler = onAction;
        hide();
        handler?.();
    });

    return { show, hide };
}
