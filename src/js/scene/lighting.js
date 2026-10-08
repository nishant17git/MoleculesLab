/* global THREE */

/** Studio lighting rig (unchanged from the original look). */
export function addStudioLighting(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.05));

    const frontFill = new THREE.DirectionalLight(0xffffff, 0.6);
    frontFill.position.set(0, 5, 5);
    scene.add(frontFill);

    const rimLight1 = new THREE.SpotLight(0xffffff, 6);
    rimLight1.position.set(5, 5, -5);
    rimLight1.lookAt(0, 0, 0);
    rimLight1.penumbra = 0.5;
    scene.add(rimLight1);

    const rimLight2 = new THREE.SpotLight(0xffffff, 3);
    rimLight2.position.set(-5, -5, -5);
    rimLight2.lookAt(0, 0, 0);
    rimLight2.penumbra = 0.5;
    scene.add(rimLight2);

    const pointLight = new THREE.PointLight(0xffffff, 2, 20);
    pointLight.position.set(0, 2, 5);
    scene.add(pointLight);
}
