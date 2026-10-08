/* global THREE */

const DESIGN_SIZE = 1024; // the face is drawn in a 1024×1024 design space, then scaled to the preset size

/**
 * Draws one coin face on a canvas and returns it as a texture.
 * Requires the "Syne" web font to be loaded first (the caller awaits it).
 */
function createCoinTexture({ text, isTails, size, anisotropy }) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.scale(size / DESIGN_SIZE, size / DESIGN_SIZE);

    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(512, 512, 480, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(512, 512, 450, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e5e5e5';
    ctx.font = 'bold 320px "Syne", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(512, 512);
    ctx.rotate(-Math.PI / 2);
    if (isTails) ctx.rotate(Math.PI);
    ctx.fillText(text, 0, 15);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = anisotropy;
    return texture;
}

/**
 * Builds the coin: `group` (idle wobble / toss height) → `wrapper` (flip rotation) → mesh.
 * @returns {{ group: THREE.Group, wrapper: THREE.Group, textures: THREE.Texture[] }}
 */
export function createCoin({ renderer, quality }) {
    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.anisotropy);
    const textureOptions = { size: quality.textureSize, anisotropy };

    const group = new THREE.Group();
    const wrapper = new THREE.Group();
    group.add(wrapper);

    const geometry = new THREE.CylinderGeometry(2.5, 2.5, 0.2, 64);

    const edgeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x333333,
        metalness: 1.0,
        roughness: 0.1,
        clearcoat: 1.0,
    });

    const faceMaterialConfig = { metalness: 0.9, roughness: 0.25, clearcoat: 0.2 };
    const headsTexture = createCoinTexture({ text: 'H', isTails: false, ...textureOptions });
    const tailsTexture = createCoinTexture({ text: 'T', isTails: true, ...textureOptions });
    const headsMaterial = new THREE.MeshPhysicalMaterial({ ...faceMaterialConfig, map: headsTexture });
    const tailsMaterial = new THREE.MeshPhysicalMaterial({ ...faceMaterialConfig, map: tailsTexture });

    const mesh = new THREE.Mesh(geometry, [edgeMaterial, headsMaterial, tailsMaterial]);
    mesh.rotation.x = Math.PI / 2;
    wrapper.add(mesh);

    return { group, wrapper, textures: [headsTexture, tailsTexture] };
}
