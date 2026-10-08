/* global THREE, gsap */
import { MODES, LOADER } from '../config.js';
import { createAudioEngine } from '../audio/audio-engine.js';
import { createServiceWorkerClient } from '../pwa/service-worker-client.js';
import { initInstallPrompt } from '../pwa/install-prompt.js';
import { watchConnectivity } from '../pwa/connectivity.js';
import { addStudioLighting } from '../scene/lighting.js';
import { createCoin } from '../scene/coin.js';
import { createGyroscope } from '../scene/gyroscope.js';
import { resolveQuality } from '../scene/quality.js';
import { createStage } from '../scene/stage.js';
import { createStatsStore } from '../storage/stats-store.js';
import { initCustomCursor } from '../ui/custom-cursor.js';
import { createLoaderScreen } from '../ui/loader-screen.js';
import { createModeNav } from '../ui/mode-nav.js';
import { createResultDisplay } from '../ui/result-display.js';
import { createStatsPanel } from '../ui/stats-panel.js';
import { createToast } from '../ui/toast.js';
import { afterPaint, whenIdle } from '../utils/async.js';
import { requireEl } from '../utils/dom.js';
import { mark } from '../utils/perf.js';
import { loadCriticalFonts, loadDeferredFonts } from '../utils/fonts.js';
import { createTossController } from './toss-controller.js';

const html = document.documentElement;

/** Failure screens: what to tell the person for each thing that can go wrong at start-up. */
const FAILURES = {
    libraries: () =>
        navigator.onLine === false
            ? {
                  title: 'Not saved yet',
                  message:
                      'Molecules Lab needs to be opened once with an internet connection. After that it works fully offline.',
              }
            : {
                  title: "Couldn't load",
                  message: 'Some required files could not be downloaded. Check your connection and try again.',
              },
    graphics: () => ({
        title: '3D view unavailable',
        message: "Your browser couldn't start the 3D view. Try again, or update your browser.",
    }),
    unknown: () => ({
        title: 'Something went wrong',
        message: 'Molecules Lab could not start. Please try again.',
    }),
};

class BootError extends Error {
    constructor(kind, cause) {
        super(`Boot failed: ${kind}`);
        this.kind = kind;
        this.cause = cause;
    }
}

/** Starts the app. Resolves when the intro has finished (or the failure screen is up). */
export async function boot() {
    const loader = createLoaderScreen(requireEl('loader'));

    // Armed first: whatever goes wrong below — an exception or a hang — the person ends up on a
    // clear message with a retry button, never a silent, frozen screen.
    const watchdog = setTimeout(() => loader.fail({ ...FAILURES.unknown(), onRetry: () => location.reload() }), 25000);

    let pwa = null;
    try {
        const toast = createToast(requireEl('toast'));
        initInstallPrompt(requireEl('install-btn'));

        pwa = createServiceWorkerClient({
            onOfflineReady: () => toast.show('Ready for offline use'),
            onUpdateReady: (apply) =>
                toast.show('Update ready', { actionLabel: 'Refresh', onAction: apply, duration: 12000 }),
        });

        html.dataset.tier = resolveQuality().tier;
        loader.start();

        await startApp({ loader, toast, pwa });
    } catch (error) {
        console.error('[boot]', error);
        const kind = error instanceof BootError ? error.kind : 'unknown';
        loader.fail(FAILURES[kind]());
    } finally {
        clearTimeout(watchdog);
        // Register after start-up so the precache download never competes with the intro.
        if (pwa) whenIdle(() => pwa.register(), 3000);
    }
}

async function startApp({ loader, toast, pwa }) {
    if (typeof THREE === 'undefined' || typeof gsap === 'undefined') {
        throw new BootError('libraries');
    }

    mark('boot-start');
    const quality = resolveQuality();

    // Fonts load in parallel with scene setup; the counter appears as soon as they're in.
    const fontsReady = loadCriticalFonts(LOADER.fontWaitMs).then(() => loader.showCounter());

    /* 1 — UI wiring (cheap) */
    const audio = createAudioEngine();
    const store = createStatsStore();
    const stats = createStatsPanel({
        store,
        headsContainer: requireEl('stat-heads-container'),
        tailsContainer: requireEl('stat-tails-container'),
        resetButton: requireEl('reset-stats-btn'),
    });
    const resultDisplay = createResultDisplay({
        textEl: requireEl('result-display'),
        liveRegion: requireEl('result-live'),
    });
    initCustomCursor(requireEl('cursor'));
    loader.setProgress(0.1);
    mark('ui-wired');
    await afterPaint();

    /* 2 — GPU context, lighting, rings */
    let stage;
    try {
        stage = createStage({
            container: requireEl('canvas-container'),
            quality,
            onQualityFloor: () => { html.dataset.tier = 'low'; },
        });
    } catch (error) {
        throw new BootError('graphics', error);
    }
    addStudioLighting(stage.scene);
    const gyroscope = createGyroscope({ quality });
    stage.scene.add(gyroscope.group);
    loader.setProgress(0.3);
    mark('gpu-context');
    await afterPaint();

    /* 3 — coin (needs the Syne font for the engraved letters) */
    await fontsReady;
    const coin = createCoin({ renderer: stage.renderer, quality });
    stage.scene.add(coin.group);
    loader.setProgress(0.5);
    mark('coin-built');
    await afterPaint();

    /* 4 — compile shaders and upload textures now, one step per task, hidden behind the loader */
    stage.prepare(coin.group);
    loader.setProgress(0.7);
    mark('coin-compiled');
    await afterPaint();

    stage.prepare(gyroscope.group);
    loader.setProgress(0.85);
    mark('rings-compiled');
    await afterPaint();

    stage.uploadTextures(coin.textures);
    stage.renderOnce([coin.group, gyroscope.group]);
    loader.setProgress(0.95);
    mark('warm-frame');
    await afterPaint();

    /* 5 — controls */
    const modeNav = createModeNav(requireEl('mode-nav'), {
        onSelect: (mode) => controller.switchMode(mode),
    });
    const controller = createTossController({
        coin,
        gyroscope,
        resultDisplay,
        stats,
        audio,
        modeNav,
        actionButton: requireEl('action-btn'),
        panels: { coin: requireEl('coin-stats'), yesNo: requireEl('yesno-info') },
    });
    modeNav.setActive(MODES.COIN);
    stage.onFrame(controller.onFrame);

    // Let the counter reach 100 (it never runs ahead of the work above).
    mark('ready');
    await loader.finished();
    mark('counter-done');

    /* 6 — reveal */
    coin.group.position.z = -10;
    coin.wrapper.rotation.set(Math.PI * 4, 0, Math.PI / 2);
    stage.start(); // rendering only begins now, so the loader animation gets the whole GPU

    await loader.exit({
        onOpen: () => {
            html.classList.add('is-ready');
            gsap.fromTo(coin.group.position, { z: -10 }, { z: 0, duration: 1.5, ease: 'expo.out' });
            gsap.fromTo(
                coin.wrapper.rotation,
                { x: Math.PI * 4, z: Math.PI / 2 },
                { x: 0, z: 0, duration: 1.9, ease: 'power3.out' }
            );
        },
    });

    mark('intro-done');

    /* 7 — after the intro: connectivity notices + background housekeeping (idle time only) */
    watchConnectivity({
        onOffline: () => toast.show('Offline — everything works', { tone: 'offline' }),
        onOnline: () => {
            toast.show('Back online');
            pwa.checkForUpdate();
            pwa.verifyOfflineCache();
        },
    });

    whenIdle(() => {
        audio.preload();
        loadDeferredFonts().then(() => pwa.verifyOfflineCache());
    }, 4000);
}
