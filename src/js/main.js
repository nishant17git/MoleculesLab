/**
 * Molecules Lab — entry point.
 *
 * three.js and GSAP are classic scripts loaded (deferred) before this module runs,
 * so they are available as the globals `THREE` and `gsap`.
 */
import { boot } from './app/boot.js';
import { onDomReady } from './utils/dom.js';

onDomReady(boot);
