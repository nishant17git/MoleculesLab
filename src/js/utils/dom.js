/** Small DOM helpers. */

export const byId = (id) => document.getElementById(id);

/** Like `byId`, but fails loudly (with the id in the message) if the markup is out of sync. */
export function requireEl(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Required element #${id} is missing from index.html`);
    return el;
}

/** Runs `fn` once the DOM is parsed (immediately if it already is). */
export function onDomReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}
