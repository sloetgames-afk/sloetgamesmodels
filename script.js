let scene, camera, renderer, controls, mixer;
const clock = new THREE.Clock();

function init() {
    // 1. Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 10, 100); 

    // 2. Grid (Piso)
    const grid = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
    grid.position.y = -0.01;
    scene.add(grid);

    // 3. Iluminación
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    // Optimización: Tamaño de mapa de sombras ajustado para balance calidad/rendimiento
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.5);
    fillLight.position.set(-5, 5, 5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffaa00, 0.5);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 4. Cámara
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(8, 5, 8);

    // 5. Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // IMPORTANTE PARA MÓVILES: Limitar pixelRatio a 2 para ahorrar batería y GPU
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    document.body.appendChild(renderer.domElement);

    // 6. Controles
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();

    // Eventos
    window.addEventListener('resize', onWindowResize);
    document.getElementById('fileInput').addEventListener('change', loadFile);

    animate();
}

// --- LÓGICA DE CARGA ---
function loadFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reiniciar UI
    const loaderEl = document.getElementById('loader');
    const statusEl = document.getElementById('status');
    
    loaderEl.style.display = 'flex';
    statusEl.innerText = `Leyendo: ${file.name}`;
    
    const url = URL.createObjectURL(file);
    const extension = file.name.split('.').pop().toLowerCase();

    setTimeout(() => {
        try {
            switch (extension) {
                case 'fbx': loadModel(new THREE.FBXLoader(), url, extension); break;
                case 'gltf': 
                case 'glb': loadModel(new THREE.GLTFLoader(), url, extension); break;
                case 'obj': loadModel(new THREE.OBJLoader(), url, extension); break;
                case 'stl': loadSTL(url); break;
                default:
                    throw new Error("Formato no soportado.");
            }
        } catch (e) {
            onError(e);
        }
    }, 100);
}

function loadModel(loader, url, ext) {
    loader.load(url, (loadedData) => {
        let object;
        
        if (ext === 'gltf' || ext === 'glb') {
            object = loadedData.scene;
            if (loadedData.animations && loadedData.animations.length > 0) {
                object.animations = loadedData.animations;
            }
        } else {
            object = loadedData;
        }
        
        onModelLoaded(object);
    }, onProgress, onError);
}

function loadSTL(url) {
    const loader = new THREE.STLLoader();
    loader.load(url, (geometry) => {
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x606060, 
            roughness: 0.5, 
            metalness: 0.6 
        });
        const mesh = new THREE.Mesh(geometry, material);
        geometry.center();
        
        const group = new THREE.Group();
        group.add(mesh);
        onModelLoaded(group);
    }, onProgress, onError);
}

// --- PROCESAMIENTO DEL MODELO ---
function onModelLoaded(object) {
    const prevModel = scene.getObjectByName('LoadedModel');
    if (prevModel) {
        prevModel.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                else o.material.dispose();
            }
        });
        scene.remove(prevModel);
    }

    object.name = 'LoadedModel';

    mixer = null;
    if (object.animations && object.animations.length > 0) {
        mixer = new THREE.AnimationMixer(object);
        const action = mixer.clipAction(object.animations[0]);
        action.play();
        document.getElementById('status').innerHTML = `<span style="color:#4facfe">▶ Reproduciendo:</span> ${object.animations[0].name}`;
    } else {
        document.getElementById('status').innerText = "Modelo cargado (Estático)";
    }

    object.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
                child.material.side = THREE.DoubleSide;
                if (!child.material.map) {
                    child.material.roughness = 0.7;
                    child.material.metalness = 0.1;
                }
            }
        }
    });

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object.position.x = -center.x;
    object.position.y = -center.y;
    object.position.z = -center.z;

    const pivot = new THREE.Group();
    pivot.add(object);
    pivot.name = 'LoadedModel';
    
    const yOffset = size.y / 2;
    object.position.y += yOffset; 

    scene.add(pivot);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    cameraDist *= 1.8; 

    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    const finalPos = direction.multiplyScalar(cameraDist);

    camera.position.copy(finalPos);
    camera.lookAt(0, size.y / 2, 0);
    
    controls.target.set(0, size.y / 2, 0);
    controls.update();
    
    scene.fog.near = cameraDist * 2;
    scene.fog.far = cameraDist * 5;

    document.getElementById('loader').style.display = 'none';
}

function onProgress(xhr) {
    if(xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        document.getElementById('status').innerText = `Cargando datos: ${percent}%`;
    }
}

function onError(error) {
    console.error(error);
    document.getElementById('loader').style.display = 'none';
    document.getElementById('status').innerHTML = `<span style="color:#ff4444">⚠ Error al cargar</span>`;
    alert("Error: Verifica que el archivo sea un modelo 3D válido.");
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
}

// Iniciar aplicación
init();
