import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Global declarations for Scene Graph components, state management, and 3D asset templates.
let scene, camera, renderer;
let player, obstacles = [], buildings = [], rails = []; 
let speed = 0.25;
let lane = 0; 
let score = 0;
let scoreDiv;
let gameRunning = true;
let mixer; 
const clock = new THREE.Clock(); 

let tramModelTemplate = null;
let barricadeModelTemplate = null;
let midBarricadeTemplate = null;
let highBarricadeTemplate = null; 
let railTemplate = null; 
let buildingTemplates = []; 

let isJumping = false;
let isCrawling = false;
let velocityY = 0;
const gravity = -0.02; 

let sunSphere, moonSphere;
let mainLight;
let dayTime = 0; 
const daySkyColor = new THREE.Color(0x87ceeb); 
const nightSkyColor = new THREE.Color(0x00000c); 
let starsMaterial;
let cloudMaterial;

let nextLeftBuildingZ = 20;
let nextRightBuildingZ = 20;

init();
animate();

// Initializes WebGL context, Scene Graph (PBR & Shadow Mapping), lighting, and asset loading.
function init() {
    scene = new THREE.Scene();
    scene.background = nightSkyColor.clone();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 12);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(60);
    for (let i = 0; i < 20; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 300;    
        starPos[i * 3 + 1] = 10 + Math.random() * 100;    
        starPos[i * 3 + 2] = -50 - Math.random() * 150;   
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0 });
    scene.add(new THREE.Points(starGeo, starsMaterial));

    const clouds = new THREE.Group();
    cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 1, flatShading: true });
    
    function createCloud() {
        const cloudGroup = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(2, 8, 8);
        const m1 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m1.scale.set(1.5, 1.5, 1.5); cloudGroup.add(m1);
        const m2 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m2.position.set(-2.5, -0.5, 0); cloudGroup.add(m2);
        const m3 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m3.position.set(2.5, -0.5, 0); cloudGroup.add(m3);
        const m4 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m4.position.set(0, 0.5, 1.5); m4.scale.set(1.2, 1.2, 1.2); cloudGroup.add(m4);
        return cloudGroup;
    }

    for (let i = 0; i < 8; i++) {
        const c = createCloud();
        c.position.set((Math.random() - 0.5) * 120, 25 + Math.random() * 15, -50 - Math.random() * 80);
        clouds.add(c);
    }
    scene.add(clouds);

    const celestialGeometry = new THREE.SphereGeometry(4, 16, 16);
    moonSphere = new THREE.Mesh(celestialGeometry, new THREE.MeshBasicMaterial({ color: 0xffffe0 }));
    scene.add(moonSphere);
    sunSphere = new THREE.Mesh(celestialGeometry, new THREE.MeshBasicMaterial({ color: 0xfff5b6 }));
    scene.add(sunSphere);

    mainLight = new THREE.DirectionalLight(0xffffff, 1); 
    mainLight.castShadow = true;
    mainLight.shadow.camera.top = mainLight.shadow.camera.right = 50; 
    mainLight.shadow.camera.bottom = mainLight.shadow.camera.left = -50; 
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 150; 
    mainLight.shadow.mapSize.width = mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const loader = new GLTFLoader();

    const loadModel = (path, targetH, rotY, scaleType, callback) => {
        loader.load(path, gltf => {
            const m = gltf.scene;
            m.name = path;
            const size = new THREE.Vector3();
            new THREE.Box3().setFromObject(m).getSize(size);
            
            const scale = scaleType === 'z' ? (size.z > 0 ? targetH / size.z : 1) : targetH / size.y;
            scaleType === 'z' ? m.scale.set(2, 1, scale) : m.scale.set(scale, scale, scale);
            
            m.rotation.y = rotY;
            m.position.y -= new THREE.Box3().setFromObject(m).min.y;
            
            m.traverse(c => {
                if (c.isMesh) { c.castShadow = c.receiveShadow = true; }
                if (c.isLight) { c.intensity = 0; c.visible = false; }
            });
            callback(m);
        });
    };

    ['glb_model/b1.glb', 'glb_model/b2.glb'].forEach(f => 
        loadModel(f, 12, 0, 'y', m => buildingTemplates.push(m))
    );

    loadModel('glb_model/train.glb', 5.0, Math.PI / 2, 'y', m => tramModelTemplate = m);
    loadModel('glb_model/low_b.glb', 1.0, -Math.PI / 2, 'y', m => barricadeModelTemplate = m);
    loadModel('glb_model/mid_b.glb', 1.75, -Math.PI / 2, 'y', m => midBarricadeTemplate = m);
    loadModel('glb_model/high_b.glb', 2.5, -Math.PI / 2, 'y', m => highBarricadeTemplate = m);
    loadModel('glb_model/rail.glb', 15, 0, 'z', m => railTemplate = m);

    scoreDiv = document.createElement('div');
    Object.assign(scoreDiv.style, { position: 'absolute', top: '10px', left: '10px', color: 'white', fontSize: '24px', fontWeight: 'bold' });
    scoreDiv.innerHTML = 'Score: 0';
    document.body.appendChild(scoreDiv);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 200), new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.8}));
    ground.rotation.x = -Math.PI/2;
    ground.position.z = -50;
    ground.receiveShadow = true;
    scene.add(ground);

    player = new THREE.Group();
    scene.add(player);

    loader.load('glb_model/man.glb', gltf => {
        const m = gltf.scene;
        m.scale.set(0.7, 0.7, 0.7);
        m.rotation.y = Math.PI;
        m.traverse(c => {
            if (c.isMesh || c.isSkinnedMesh) {
                c.castShadow = c.receiveShadow = true;
                c.frustumCulled = false; 
                if (c.material) [].concat(c.material).forEach(mat => { mat.transparent = false; mat.depthWrite = true; mat.alphaTest = 0.5; });
            }
        });
        if (gltf.animations?.length) {
            mixer = new THREE.AnimationMixer(m);
            mixer.clipAction(gltf.animations[0]).play();
        }
        player.add(m);
    });

    window.addEventListener('keydown', e => {
        if (!gameRunning) return;
        if (e.key === 'ArrowLeft' && lane > -1) lane -= 2;
        if (e.key === 'ArrowRight' && lane < 1) lane += 2;
        if (e.key === 'ArrowUp' && !isJumping) { velocityY = 0.35; isJumping = true; }
        if (e.key === 'ArrowDown' && !isCrawling) {
            isCrawling = true;
            player.rotation.x = Math.PI / 2; 
            setTimeout(() => { isCrawling = false; player.rotation.x = 0; }, 600);
        }
    });

    setInterval(() => { if (gameRunning) spawnObstacle(); }, 800);
    setInterval(() => { if (gameRunning) spawnRails(); }, 800);
}

// Releases WebGL bindings (VBOs, shaders) from GPU memory to prevent VRAM exhaustion upon object culling.
function disposeNode(node) {
    if (node instanceof THREE.Mesh) {
        node.geometry?.dispose();
        if (node.material) [].concat(node.material).forEach(mat => mat.dispose());
    }
}

// Computes Axis-Aligned Bounding Box (AABB) in world space for Collision Detection mapping.
function calculateHitbox(obj) {
    obj.updateMatrixWorld(true); 
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(obj).getSize(size);
    return { x: size.x / 2, z: size.z / 2 };
}

// Procedurally instantiates obstacle meshes via strictly cloned templates and assigns spatial configurations.
function spawnObstacle() {
    const r = Math.random();
    let obs, type;

    if (r < 0.25) {
        if (!tramModelTemplate) return;
        obs = tramModelTemplate.clone(); type = 'train';
    } else if (r < 0.5) {
        if (!barricadeModelTemplate) return;
        obs = barricadeModelTemplate.clone(); type = 'low';
        obs.scale.set(1.5, 1.5, 1.5);
    } else if (r < 0.75) {
        if (!midBarricadeTemplate) return;
        obs = midBarricadeTemplate.clone(); type = 'mid';
    } else {
        if (!highBarricadeTemplate) return;
        obs = highBarricadeTemplate.clone(); type = 'high';
    }

    obs.userData = { type, hitbox: calculateHitbox(obs) };
    obs.position.set([-4, 0, 4][Math.floor(Math.random()*3)], obs.position.y, -60);
    scene.add(obs);
    obstacles.push(obs);
}

// Handles structural environment spawning, adapting Euler angles for facade alignment based on Frustum depths.
function spawnBuildingSide(side) {
    if (!buildingTemplates.length) return;
    let b = buildingTemplates[Math.floor(Math.random() * buildingTemplates.length)].clone();
    
    b.rotation.y = side === 'left' ? (b.name.includes('b3') ? -Math.PI/2 : (b.name.includes('b1') ? 2*Math.PI : 0)) 
                                   : (b.name.includes('b3') ? Math.PI/2 : Math.PI);
    if (b.name.includes('b2')) b.position.y = 6;
    
    b.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b);
    
    b.position.x += side === 'left' ? (-6.5 - box.max.x) : (6.5 - box.min.x);
    b.position.z = (side === 'left' ? nextLeftBuildingZ : nextRightBuildingZ) + (b.position.z - box.max.z);
    
    side === 'left' ? nextLeftBuildingZ -= (box.max.z - box.min.z) : nextRightBuildingZ -= (box.max.z - box.min.z);
    
    scene.add(b);
    buildings.push(b);
}

// Procedurally generates path meshes mapping terrain lines.
function spawnRails() {
    if (!railTemplate) return;
    [-4, 0, 4].forEach(x => {
        const rail = railTemplate.clone();
        rail.position.set(x, 0.01, -60); 
        scene.add(rail);
        rails.push(rail);
    });
}

// Terminates rendering loop and generates DOM-based GUI overlay for the state boundary.
function showGameOver() {
    gameRunning = false;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '20px', color: 'white' });
    overlay.innerHTML = `<h2>Game Over</h2><p>Score: ${Math.floor(score)}</p><button onclick="location.reload()">Restart</button>`;
    document.body.appendChild(overlay);
}

// Core Event Loop via requestAnimationFrame.
// Implements Reverse Array Iterators for seamless garbage collection, Lerp for kinematics, and AABB intersection boolean logic.
function animate() {
    requestAnimationFrame(animate);
    if (!gameRunning) return;

    if (mixer) mixer.update(clock.getDelta());

    nextLeftBuildingZ += speed;
    nextRightBuildingZ += speed;
    while (nextLeftBuildingZ > -120 && buildingTemplates.length) spawnBuildingSide('left');
    while (nextRightBuildingZ > -120 && buildingTemplates.length) spawnBuildingSide('right');

    dayTime += 0.002; 
    sunSphere.position.set(Math.cos(dayTime) * 50, Math.sin(dayTime) * 50, -60);
    moonSphere.position.set(Math.cos(dayTime + Math.PI) * 50, Math.sin(dayTime + Math.PI) * 50, -60);

    let sunRatio = Math.max(0, Math.min(1, (sunSphere.position.y + 12.5) / 25)); 
    scene.background.copy(nightSkyColor).lerp(daySkyColor, sunRatio); 
    if (starsMaterial) starsMaterial.opacity = 1 - sunRatio; 
    if (cloudMaterial) cloudMaterial.opacity = sunRatio;     

    mainLight.position.copy(sunSphere.position.y > moonSphere.position.y ? sunSphere.position : moonSphere.position);
    mainLight.color.setHex(sunSphere.position.y > moonSphere.position.y ? 0xfff5b6 : 0xffffe0); 
    mainLight.intensity = sunSphere.position.y > moonSphere.position.y ? 1.0 : 0.5;

    score += 0.1;
    if (Math.floor(score) !== scoreDiv._lastScore) {
        scoreDiv.textContent = `Score: ${scoreDiv._lastScore = Math.floor(score)}`;
    }

    player.position.x = THREE.MathUtils.lerp(player.position.x, lane*2, 0.2); 
    if (isJumping) {
        player.position.y = Math.max(0, player.position.y + velocityY);
        velocityY += gravity; 
        if (player.position.y === 0) isJumping = false;
    }

    camera.position.set(
        THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.15),
        THREE.MathUtils.lerp(camera.position.y, player.position.y + (isCrawling ? 4 : 6), 0.15),
        camera.position.z
    );
    camera.lookAt(player.position.x, player.position.y + (isCrawling ? 0.5 : 2), player.position.z - 20);

    const checkCulling = (arr, limit) => {
        for (let i = arr.length - 1; i >= 0; i--) {
            arr[i].position.z += speed;
            if (arr[i].position.z > limit) {
                scene.remove(arr[i]);
                arr[i].traverse(disposeNode);
                arr.splice(i, 1);
            }
        }
    };

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.position.z += speed; 

        const hit = obs.userData.hitbox || { x: 0.75, z: 0.75 };
        if (Math.abs(obs.position.z - player.position.z) < (hit.z + 0.15) && 
            Math.abs(obs.position.x - player.position.x) < (hit.x + 0.15)) {
            
            const t = obs.userData.type;
            if (t === 'train' || (t === 'low' && !isJumping) || (t === 'mid' && !isJumping && !isCrawling) || (t === 'high' && !isCrawling)) {
                showGameOver();
            }
        }

        if (obs.position.z > 10) {
            scene.remove(obs);
            obs.traverse(disposeNode);
            obstacles.splice(i, 1);
        }
    }

    checkCulling(buildings, 40);
    checkCulling(rails, 20);
    renderer.render(scene, camera);
}

// Recomputes Camera Projection Matrix dynamically on resize preventing scaling distortion.
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});