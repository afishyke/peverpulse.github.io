document.addEventListener('DOMContentLoaded', () => {
    // AOS initialization
    if (typeof AOS !== 'undefined') {
        AOS.init();
    }

    // Three.js background animation
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true // Make canvas transparent
        });
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Create a wireframe icosahedron
        const geometry = new THREE.IcosahedronGeometry(2, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFD700, // Gold color
            wireframe: true
        });
        const icosahedron = new THREE.Mesh(geometry, material);
        scene.add(icosahedron);

        camera.position.z = 5;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            icosahedron.rotation.x += 0.005;
            icosahedron.rotation.y += 0.005;

            renderer.render(scene, camera);
        }
        animate();

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
});
