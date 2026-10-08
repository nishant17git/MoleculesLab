/* global gsap */
import { MODES } from '../config.js';
import { startGyroscopeIdle } from '../scene/gyroscope.js';

/**
 * Game logic: the coin toss, the yes/no "decision", switching between modes and the idle
 * motion. Owns the `isAnimating` / `mode` state that gates user input.
 */
export function createTossController({
    coin,
    gyroscope,
    resultDisplay,
    stats,
    audio,
    modeNav,
    actionButton,
    panels,
}) {
    const { group: coinGroup, wrapper: coinWrapper } = coin;
    const { group: gyroGroup, rings } = gyroscope;
    const TURN = Math.PI * 2;

    let mode = MODES.COIN;
    let isAnimating = false;

    /** Called every frame by the stage: gentle floating while nothing else is animating. */
    function onFrame(elapsed) {
        if (isAnimating) return;
        if (mode === MODES.COIN) {
            coinGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.15;
            coinGroup.rotation.x = Math.cos(elapsed * 0.4) * 0.15;
            coinGroup.position.y = Math.sin(elapsed * 1.5) * 0.1;
        } else {
            gyroGroup.position.y = Math.sin(elapsed * 1.5) * 0.1;
        }
    }

    function tossCoin() {
        if (isAnimating) return;
        isAnimating = true;
        audio.unlock();

        resultDisplay.hide();
        const isHeads = Math.random() > 0.5;
        const resultText = isHeads ? 'HEADS' : 'TAILS';
        const targetRotX = (Math.floor(coinWrapper.rotation.x / TURN) + 5) * TURN + (isHeads ? 0 : Math.PI);

        const tl = gsap.timeline({
            onComplete: () => {
                isAnimating = false;
                stats.record(resultText);
                resultDisplay.show(resultText);
                audio.playCoinCatch();
            },
        });

        tl.to(coinGroup.position, { y: 5, duration: 1, ease: 'power2.out' }, 0);
        tl.to(coinWrapper.rotation, { x: targetRotX, duration: 2.2, ease: 'expo.inOut', onStart: () => audio.playCoinToss() }, 0);
        tl.to(coinGroup.position, { y: 0, duration: 1, ease: 'bounce.out' }, 1.2);
    }

    function decide() {
        if (isAnimating) return;
        isAnimating = true;
        audio.unlock();

        resultDisplay.hide();
        audio.playWhoosh();
        const resultText = Math.random() > 0.5 ? 'YES' : 'NO';

        gsap.killTweensOf(rings.map((ring) => ring.rotation));
        const tl = gsap.timeline();

        rings.forEach((ring, index) => {
            const targetX = Math.ceil(ring.rotation.x / TURN) * TURN + TURN * (4 + (index % 2 === 0 ? 1 : -1));
            const targetY = Math.ceil(ring.rotation.y / TURN) * TURN + TURN * (4 + index);
            const targetZ = Math.ceil(ring.rotation.z / TURN) * TURN;
            tl.to(ring.rotation, { x: targetX, y: targetY, z: targetZ, duration: 2.5, ease: 'expo.inOut' }, 0);
        });

        tl.call(() => audio.playThud(), [], 2.4);
        tl.call(() => resultDisplay.show(resultText), [], 2.5);
        tl.call(() => {
            isAnimating = false;
            startGyroscopeIdle(rings);
        }, [], 4.5);
    }

    function showPanelsFor(nextMode) {
        panels.coin.classList.toggle('is-inactive', nextMode !== MODES.COIN);
        panels.yesNo.classList.toggle('is-inactive', nextMode !== MODES.YES_NO);
    }

    function switchMode(nextMode) {
        if (isAnimating || mode === nextMode) return;
        mode = nextMode;
        const toCoin = nextMode === MODES.COIN;

        modeNav.setActive(nextMode);
        resultDisplay.hide();
        actionButton.textContent = toCoin ? 'TOSS' : 'ASK';

        // Shrink the outgoing object, swap, then spring the incoming one in.
        gsap.to(toCoin ? gyroGroup.scale : coinGroup.scale, {
            x: 0, y: 0, z: 0,
            duration: 0.4,
            ease: 'back.in(1.7)',
            onComplete: () => {
                coinGroup.visible = toCoin;
                gyroGroup.visible = !toCoin;
                showPanelsFor(nextMode);
                gsap.fromTo(
                    toCoin ? coinGroup.scale : gyroGroup.scale,
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' }
                );
            },
        });
    }

    actionButton.addEventListener('click', () => {
        if (mode === MODES.COIN) tossCoin();
        else decide();
    });

    // Rings idle from the start (they're hidden until Yes/No mode is selected).
    startGyroscopeIdle(rings);

    return {
        onFrame,
        switchMode,
        get mode() { return mode; },
        get isAnimating() { return isAnimating; },
    };
}
