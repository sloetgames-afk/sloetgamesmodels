body { 
    margin: 0; overflow: hidden; background-color: #121212; 
    color: #fff; font-family: sans-serif; overscroll-behavior: none;
}

#ui-container {
    position: absolute; top: 20px; left: 20px; z-index: 10;
    background: rgba(20, 20, 20, 0.9); backdrop-filter: blur(10px);
    padding: 20px; border-radius: 12px; border: 1px solid #333;
    width: 220px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

h1 { font-size: 16px; margin: 0 0 15px 0; color: #4facfe; text-transform: uppercase; }

input[type="file"] { display: none; }

.custom-file-upload, .btn-delete {
    display: flex; align-items: center; justify-content: center;
    padding: 12px; cursor: pointer; border-radius: 8px;
    font-weight: bold; font-size: 14px; transition: 0.2s;
    width: 100%; border: none; margin-bottom: 8px;
    box-sizing: border-box;
}

.custom-file-upload {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    color: white;
}

.btn-delete {
    background: #2a2a2a; color: #ff4444; border: 1px solid #444;
}

.btn-delete:hover { background: #ff4444; color: white; }

#status { margin-top: 10px; font-size: 12px; color: #aaa; }
.info-text { font-size: 10px; color: #555; margin-top: 5px; }

#loader {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: none;
    justify-content: center; align-items: center; flex-direction: column; z-index: 100;
}

.spinner {
    border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #4facfe;
    border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* AJUSTE MÓVIL */
@media (max-width: 600px) {
    #ui-container {
        top: auto; bottom: 30px; left: 50%;
        transform: translateX(-50%); width: 90%;
    }
}
let scene, camera, renderer, controls, mixer;
const clock = new THREE.Clock();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    // Luces
    const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(ambient);
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7);
    scene.add(light);

    // Cámara
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizado móvil
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Controles
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Eventos
    window.addEventListener('resize', onWindowResize);
    document.getElementById('fileInput').addEventListener('change', handleFile);
    document.getElementById('deleteBtn').addEventListener('click', clearScene);

    animate();
}

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    clearScene(); // Borrar anterior antes de cargar nuevo
    
    document.getElementById('loader').style.display = 'flex';
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();

    let loader;
    if (ext === 'glb' || ext === 'gltf') loader = new THREE.GLTFLoader();
    else if (ext === 'fbx') loader = new THREE.FBXLoader();
    else if (ext === 'obj') loader = new THREE.OBJLoader();
    else if (ext === 'stl') loader = new THREE.STLLoader();

    if (loader) {
        loader.load(url, (data) => {
            let obj = data.scene || data;
            if (ext === 'stl') {
                const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
                obj = new THREE.Mesh(data, mat);
            }
            setupModel(obj, data.animations);
        }, undefined, (err) => {
            console.error(err);
            document.getElementById('loader').style.display = 'none';
        });
    }
}

function setupModel(obj, animations) {
    obj.name = "LoadedModel";
    
    // Centrar
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);

    scene.add(obj);

    // Animaciones
    if (animations && animations.length > 0) {
        mixer = new THREE.AnimationMixer(obj);
        mixer.clipAction(animations[0]).play();
    }

    document.getElementById('loader').style.display = 'none';
    document.getElementById('status').innerText = "Modelo cargado.";
}

function clearScene() {
    const model = scene.getObjectByName("LoadedModel");
    if (model) {
        model.traverse(n => {
            if (n.geometry) n.geometry.dispose();
            if (n.material) {
                if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
                else n.material.dispose();
            }
        });
        scene.remove(model);
        mixer = null;
        document.getElementById('status').innerText = "Memoria limpia.";
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera);
}

init();
