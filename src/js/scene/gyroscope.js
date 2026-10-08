/* global THREE, gsap */

/** [radius, tube thickness] for each ring. */
const RING_CONFIG = [
    [2.6, 0.02],
    [2.1, 0.04],
    [1.6, 0.06],
];

/**
 * Three concentric rings used in Yes/No mode. Starts hidden.
 * The tube is very thin on screen, so far fewer radial segments than the original 64
 * look identical while cutting the triangle count several-fold.
 * @returns {{ group: THREE.Group, rings: THREE.Mesh[] }}
 */
export function createGyroscope({ quality }) {
    const group = new THREE.Group();
    group.visible = false;

    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05,
        clearcoat: 1.0,
    });

    const rings = RING_CONFIG.map(([radius, thickness], index) => {
        const geometry = new THREE.TorusGeometry(
            radius,
            thickness,
            quality.torusRadialSegments,
            quality.torusTubularSegments
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
            speedX: (index % 2 === 0 ? 1 : -1) * (0.005 + Math.random() * 0.01),
            speedY: (index % 3 === 0 ? 1 : -1) * (0.005 + Math.random() * 0.01),
            speedZ: (index % 2 !== 0 ? 1 : -1) * (0.005 + Math.random() * 0.01),
        };
        group.add(mesh);
        return mesh;
    });

    return { group, rings };
}

/** Slow endless rotation of each ring on all three axes. */
export function startGyroscopeIdle(rings) {
    const turn = Math.PI * 2;
    rings.forEach((ring, index) => {
        gsap.to(ring.rotation, {
            x: `${index % 2 === 0 ? '+=' : '-='}${turn}`,
            duration: 12 + index * 2,
            repeat: -1,
            ease: 'none',
        });
        gsap.to(ring.rotation, {
            y: `${index % 3 === 0 ? '+=' : '-='}${turn}`,
            duration: 15 - index,
            repeat: -1,
            ease: 'none',
        });
        gsap.to(ring.rotation, {
            z: `${index % 2 !== 0 ? '+=' : '-='}${turn}`,
            duration: 10 + index * 3,
            repeat: -1,
            ease: 'none',
        });
    });
}
