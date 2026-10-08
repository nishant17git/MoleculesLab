/* global THREE */
import { createAdaptiveQuality } from './quality.js';

/**
 * The WebGL stage: scene, camera, renderer, resize handling and the render loop.
 * Owns everything GPU-related so feature code (coin, rings) only deals with objects.
 */
export function createStage({ container, quality, onQualityFloor }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
    });

    let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);

    /* ---- Sizing ---- */

    let width = 0;
    let height = 0;

    function resize(force = false) {
        if (!force && width === window.innerWidth && height === window.innerHeight) return;
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.position.z = width < 768 ? 16 : 12;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Mobile browsers fire many resize events while the URL bar moves; coalesce to one per frame.
    let resizeQueued = false;
    function queueResize() {
        if (resizeQueued) return;
        resizeQueued = true;
        requestAnimationFrame(() => {
            resizeQueued = false;
            resize();
        });
    }
    window.addEventListener('resize', queueResize);
    window.addEventListener('orientationchange', queueResize);
    resize(true);

    /* ---- Adaptive quality ---- */

    const adaptive = createAdaptiveQuality({
        getPixelRatio: () => pixelRatio,
        setPixelRatio(next) {
            pixelRatio = next;
            renderer.setPixelRatio(next);
        },
        onFloor: onQualityFloor,
    });

    /* ---- Render loop ---- */

    let frameHandler = null;
    let rafId = 0;
    let running = false;
    let startedAt = 0;
    let lastFrameAt = 0;

    function frame(now) {
        rafId = requestAnimationFrame(frame);
        frameHandler?.((now - startedAt) / 1000);
        renderer.render(scene, camera);
        adaptive.sample(now - lastFrameAt);
        lastFrameAt = now;
    }

    function start() {
        if (running) return;
        running = true;
        startedAt = lastFrameAt = performance.now();
        rafId = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
    }

    // If the GPU context is lost (common on low-memory phones when the app is backgrounded),
    // pause quietly; three.js restores its own state when the browser hands the context back.
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        stop();
    });
    canvas.addEventListener('webglcontextrestored', () => {
        start();
    });

    /* ---- Warm-up (done while the loader is on screen) ---- */

    /**
     * Adds an object and compiles its shaders now, so the first time it is shown there is
     * no hitch. The object is made visible just for the compile in case it starts hidden.
     */
    function prepare(object) {
        if (!object.parent) scene.add(object);
        const wasVisible = object.visible;
        object.visible = true;
        renderer.compile(scene, camera);
        object.visible = wasVisible;
    }

    /** Uploads textures to the GPU ahead of the first frame (where supported). */
    function uploadTextures(textures) {
        if (typeof renderer.initTexture !== 'function') return;
        textures.forEach((texture) => renderer.initTexture(texture));
    }

    /** Renders one frame with every listed object visible, uploading geometry buffers too. */
    function renderOnce(objects = []) {
        const previous = objects.map((object) => object.visible);
        objects.forEach((object) => { object.visible = true; });
        renderer.render(scene, camera);
        objects.forEach((object, index) => { object.visible = previous[index]; });
    }

    return {
        scene,
        camera,
        renderer,
        start,
        stop,
        prepare,
        uploadTextures,
        renderOnce,
        /** Register the per-frame callback; receives elapsed seconds since the loop started. */
        onFrame(handler) { frameHandler = handler; },
        get running() { return running; },
    };
}
