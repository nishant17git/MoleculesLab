/**
 * Sound + haptics.
 *
 * - The coin sample is a regular media element. Offline, the service worker answers
 *   its Range requests from cache (see sw.js), so it plays exactly like online.
 * - The whoosh/thud effects are synthesised with Web Audio (no asset needed).
 * - Browsers only allow audio after a user gesture, so everything is unlocked from
 *   the first tap on the action button.
 */

const COIN_SOUND_URL = 'assets/audio/coin-toss.mp3';

export function createAudioEngine() {
    let ctx = null;
    let coinSound = null;
    let noiseBuffer = null;

    function ensureCoinSound() {
        if (!coinSound) {
            coinSound = new Audio(COIN_SOUND_URL);
            coinSound.preload = 'auto';
        }
        return coinSound;
    }

    /** Fetch the sample ahead of time (idle) so it lands in the cache and the first toss is instant. */
    function preload() {
        ensureCoinSound().load();
    }

    /** Call from a user gesture. */
    function unlock() {
        try {
            if (!ctx) {
                const Context = window.AudioContext || window.webkitAudioContext;
                if (Context) ctx = new Context();
            }
            if (ctx && ctx.state === 'suspended') ctx.resume();
            ensureCoinSound().load();
        } catch { /* audio is optional */ }
    }

    function playCoinToss() {
        const sound = ensureCoinSound();
        try {
            sound.currentTime = 0;
            const attempt = sound.play();
            if (attempt && attempt.catch) attempt.catch(() => { /* blocked or interrupted: ignore */ });
        } catch { /* ignore */ }
    }

    function vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    function playCoinCatch() {
        vibrate([40]);
    }

    function getNoiseBuffer() {
        if (!noiseBuffer) {
            const size = ctx.sampleRate * 2.0;
            noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        }
        return noiseBuffer;
    }

    function playWhoosh() {
        if (!ctx) return;
        const t = ctx.currentTime;

        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer();

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(2000, t + 1);
        filter.frequency.linearRampToValueAtTime(100, t + 2);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 1);
        gain.gain.linearRampToValueAtTime(0, t + 2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
        noise.stop(t + 2);
    }

    function playThud() {
        if (ctx) {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
            gain.gain.setValueAtTime(0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(t + 0.4);
        }
        vibrate([100, 50, 100]);
    }

    return { preload, unlock, playCoinToss, playCoinCatch, playWhoosh, playThud };
}
