// Subway Surfers-like game (bigger trains, jump, crawl, multiple obstacle types)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer;
let player, obstacles = [], buildings = [], rails = []; 
let speed = 0.25;
let lane = 0;
let score = 0;
let scoreDiv;
let gameRunning = true;

let tramModelTemplate = null;
let barricadeModelTemplate = null;
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

// Biến material cho sao và mây
let starsMaterial;
let cloudMaterial;

// Biến theo dõi toạ độ Z để nối toà nhà liên tiếp
let nextLeftBuildingZ = 20;
let nextRightBuildingZ = 20;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = nightSkyColor.clone();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // --- 1. TẠO SAO (SỐ LƯỢNG ÍT) CHO BAN ĐÊM ---
    const starGeo = new THREE.BufferGeometry();
    const starCount = 200; // Số lượng ít
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 300;     // Trải dài trục X
        starPos[i * 3 + 1] = 10 + Math.random() * 100;    // Trên cao trục Y
        starPos[i * 3 + 2] = -50 - Math.random() * 150;   // Phía xa trục Z
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        size: 0.7, 
        transparent: true, 
        opacity: 0 // Ban ngày bắt đầu ẩn
    });
    const stars = new THREE.Points(starGeo, starsMaterial);
    scene.add(stars);

    // --- 2. TẠO MÂY BAN NGÀY BẰNG KHỐI CƠ BẢN ---
    const clouds = new THREE.Group();
    cloudMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 1, 
        flatShading: true // Giúp mây trông có góc cạnh, hợp game low poly
    });
    
    // Hàm tạo 1 cụm mây từ các khối cầu
    function createCloud() {
        const cloudGroup = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(2, 8, 8);
        
        // Tâm mây
        const m1 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m1.position.set(0, 0, 0);
        m1.scale.set(1.5, 1.5, 1.5);
        cloudGroup.add(m1);
        
        // Các phần rìa mây
        const m2 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m2.position.set(-2.5, -0.5, 0);
        cloudGroup.add(m2);
        
        const m3 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m3.position.set(2.5, -0.5, 0);
        cloudGroup.add(m3);
        
        const m4 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m4.position.set(0, 0.5, 1.5);
        m4.scale.set(1.2, 1.2, 1.2);
        cloudGroup.add(m4);

        return cloudGroup;
    }

    // Tạo khoảng 8 cụm mây rải rác
    for (let i = 0; i < 8; i++) {
        const c = createCloud();
        c.position.set(
            (Math.random() - 0.5) * 120, // Toạ độ X
            25 + Math.random() * 15,     // Độ cao Y
            -50 - Math.random() * 80     // Khoảng cách Z
        );
        clouds.add(c);
    }
    scene.add(clouds);

    const celestialGeometry = new THREE.SphereGeometry(4, 32, 32);

    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 }); 
    moonSphere = new THREE.Mesh(celestialGeometry, moonMaterial);
    scene.add(moonSphere);

    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5b6 }); 
    sunSphere = new THREE.Mesh(celestialGeometry, sunMaterial);
    scene.add(sunSphere);

    mainLight = new THREE.DirectionalLight(0xffffff, 1); 
    mainLight.castShadow = true;
    mainLight.shadow.camera.top = 100;
    mainLight.shadow.camera.bottom = -50; 
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 200;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    const loader = new GLTFLoader();

    const targetBuildingHeight = 12; 
    const buildingFiles = ['b1.glb', 'b2.glb']; 
    
    buildingFiles.forEach((file) => {
        loader.load(
            file,
            function (gltf) {
                const model = gltf.scene;
                model.name = file; 
                
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);

                const scaleFactor = targetBuildingHeight / size.y;
                model.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const newBox = new THREE.Box3().setFromObject(model);
                model.position.y -= newBox.min.y; 

                model.traverse(function (child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                buildingTemplates.push(model);
            },
            undefined,
            function (error) { console.error(`Lỗi khi load ${file}:`, error); }
        );
    });

    scoreDiv = document.createElement('div');
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '10px';
    scoreDiv.style.left = '10px';
    scoreDiv.style.color = 'white';
    scoreDiv.style.fontSize = '24px';
    scoreDiv.innerHTML = 'Score: 0';
    document.body.appendChild(scoreDiv);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 300),
        new THREE.MeshStandardMaterial({color: 0x333333}) 
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.z = -50;
    ground.receiveShadow = true;
    scene.add(ground);

    player = new THREE.Group();
    player.position.y = 0.0;
    scene.add(player);

    loader.load(
        'Man.glb',
        function (gltf) {
            const model = gltf.scene;
            const targetPlayerHeight = 1.8;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scaleFactor = targetPlayerHeight / size.y;
            
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            model.rotation.y = Math.PI;
            
            const newBox = new THREE.Box3().setFromObject(model);
            model.position.y -= newBox.min.y;

            model.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            player.add(model);
        },
        undefined,
        function (error) {
            const fallbackMesh = new THREE.Mesh(
                new THREE.BoxGeometry(1, 2, 1),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );
            fallbackMesh.castShadow = true;
            fallbackMesh.receiveShadow = true;
            player.add(fallbackMesh);
        }
    );

    loader.load(
        'Tram.glb',
        function (gltf) {
            tramModelTemplate = gltf.scene;
            const targetTramHeight = 3.0;
            const box = new THREE.Box3().setFromObject(tramModelTemplate);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scaleFactor = targetTramHeight / size.y;
            tramModelTemplate.scale.set(1, 1.2, 0.5);

            const newBox = new THREE.Box3().setFromObject(tramModelTemplate);
            tramModelTemplate.position.y -= newBox.min.y;

            tramModelTemplate.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    );

    loader.load(
        'low_b.glb',
        function (gltf) {
            barricadeModelTemplate = gltf.scene;
            const targetBarricadeHeight = 1.0; 
            const box = new THREE.Box3().setFromObject(barricadeModelTemplate);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scaleFactor = targetBarricadeHeight / size.y;

            barricadeModelTemplate.scale.set(scaleFactor, scaleFactor, scaleFactor);

            barricadeModelTemplate.rotation.y = - Math.PI / 2
            const newBox = new THREE.Box3().setFromObject(barricadeModelTemplate);
            barricadeModelTemplate.position.y -= newBox.min.y; 

            barricadeModelTemplate.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    );

    loader.load(
        'high_b.glb', 
        function (gltf) {
            highBarricadeTemplate = gltf.scene;
            const targetHeight = 2.5; 
            const box = new THREE.Box3().setFromObject(highBarricadeTemplate);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scaleFactor = targetHeight / size.y;

            highBarricadeTemplate.scale.set(scaleFactor, scaleFactor, scaleFactor);
            highBarricadeTemplate.rotation.y = - Math.PI / 2; 

            const newBox = new THREE.Box3().setFromObject(highBarricadeTemplate);
            highBarricadeTemplate.position.y -= newBox.min.y; 

            highBarricadeTemplate.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    );

    loader.load(
        'rail.glb',
        function (gltf) {
            railTemplate = gltf.scene;
            const box = new THREE.Box3().setFromObject(railTemplate);
            const size = new THREE.Vector3();
            box.getSize(size);

            const targetLength = 15;
            const scaleZ = size.z > 0 ? targetLength / size.z : 1;

            railTemplate.scale.set(2, 1, scaleZ); 
            const newBox = new THREE.Box3().setFromObject(railTemplate);
            railTemplate.position.y -= newBox.min.y; 

            railTemplate.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    );

    window.addEventListener('keydown', (e) => {
        if (!gameRunning) return;

        if (e.key === 'ArrowLeft' && lane > -1) lane -= 2;
        if (e.key === 'ArrowRight' && lane < 1) lane += 2;

        if (e.key === 'ArrowUp' && !isJumping) {
            velocityY = 0.35;
            isJumping = true;
        }

        if (e.key === 'ArrowDown' && !isCrawling) {
            isCrawling = true;
            player.rotation.x = Math.PI / 2; 

            setTimeout(() => {
                isCrawling = false;
                player.rotation.x = 0; 
            }, 600);
        }
    });

    setInterval(() => {
        if (gameRunning) spawnObstacle();
    }, 800);

    setInterval(() => {
        if (gameRunning) spawnRails();
    }, 800);
}

function calculateHitbox(object) {
    object.updateMatrixWorld(true); 
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { x: size.x / 2, z: size.z / 2 };
}

// ===== OBSTACLES =====
function spawnObstacle() {
    const type = Math.random();

    if (type < 0.4) {
        let train;
        if (tramModelTemplate) {
            train = tramModelTemplate.clone();
        } else {
            train = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 1.5, 1.5),
                new THREE.MeshStandardMaterial({color: 0x2222ff})
            );
            train.castShadow = true;
            train.receiveShadow = true;
            train.position.y = 1.25;
        }

        train.userData.type = 'train';
        const lanePos = [-4,0,4][Math.floor(Math.random()*3)];
        train.position.set(lanePos, train.position.y, -60);
        
        train.userData.hitbox = calculateHitbox(train);

        scene.add(train);
        obstacles.push(train);
    }
    else if (type < 0.7) {
        let low;
        if (barricadeModelTemplate) {
            low = barricadeModelTemplate.clone();
        } else {
            low = new THREE.Mesh(
                new THREE.BoxGeometry(4, 0.7, 2),
                new THREE.MeshStandardMaterial({color: 0xffff00})
            );
            low.castShadow = true;
            low.receiveShadow = true;
            low.position.y = 0.35;
        }

        low.userData.type = 'low';
        const lanePos = [-4,0,4][Math.floor(Math.random()*3)];
        
        low.position.set(lanePos, low.position.y, -60);
        low.scale.set(1.5, 1.5, 1.5);
        
        low.userData.hitbox = calculateHitbox(low);

        scene.add(low);
        obstacles.push(low);
    }
    else {
        if (!highBarricadeTemplate) return; 

        let high = highBarricadeTemplate.clone();
        high.userData.type = 'high';
        
        const lanePos = [-4,0,4][Math.floor(Math.random()*3)];
        high.position.set(lanePos, high.position.y, -60);
        
        high.userData.hitbox = calculateHitbox(high);

        scene.add(high);
        obstacles.push(high);
    }
}

// ===== BUILDINGS =====
function createBuilding() {
    const group = new THREE.Group();
    const width = 2 + Math.random() * 2;
    const height = 12; 
    const depth = 2 + Math.random() * 2;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(
                0.2 + Math.random() * 0.5,
                0.2 + Math.random() * 0.5,
                0.2 + Math.random() * 0.5
            )
        })
    );

    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = height / 2;
    group.add(body);

    const windowMat = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffff66,
        emissiveIntensity: 0.5
    });

    for (let y = 1; y < height - 1; y += 1.5) {
        for (let x = -width/2 + 0.4; x < width/2; x += 0.8) {
            const win = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.3, 0.05),
                windowMat
            );
            win.castShadow = true;
            win.receiveShadow = true;
            win.position.set(x, y, depth/2 + 0.03);
            group.add(win);
        }
    }
    return group;
}

function spawnBuildingSide(side) {
    const targetLeftEdge = -6.5; 
    const targetRightEdge = 6.5; 

    let b;
    const randomIndex = Math.floor(Math.random() * buildingTemplates.length);
    if(buildingTemplates.length === 0) return;
    b = buildingTemplates[randomIndex].clone();

    b.position.set(0, 0, 0); 

    if (side === 'left') {
        switch (b.name) {
            case 'b1.glb': b.rotation.y = 2 * Math.PI; break;
            case 'b2.glb': b.rotation.y = 0; b.position.y = 6; break;
            case 'b3.glb': b.rotation.y = -Math.PI / 2; break;
            default: b.rotation.y = 0; break;
        }
    } else {
        switch (b.name) {
            case 'b1.glb': b.rotation.y = Math.PI; break;
            case 'b2.glb': b.rotation.y = Math.PI; b.position.y = 6; break;
            case 'b3.glb': b.rotation.y = Math.PI / 2; break;
            default: b.rotation.y = Math.PI; break;
        }
    }

    b.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b);
    const depth = box.max.z - box.min.z; 

    if (side === 'left') {
        b.position.x += (targetLeftEdge - box.max.x);
        
        const offsetZ = b.position.z - box.max.z; 
        b.position.z = nextLeftBuildingZ + offsetZ; 
        
        nextLeftBuildingZ -= depth;
    } else {
        b.position.x += (targetRightEdge - box.min.x);
        
        const offsetZ = b.position.z - box.max.z; 
        b.position.z = nextRightBuildingZ + offsetZ;
        
        nextRightBuildingZ -= depth;
    }

    scene.add(b);
    buildings.push(b);
}

// ===== RAILS =====
function spawnRails() {
    if (!railTemplate) return;
    const lanePositions = [-4, 0, 4];
    lanePositions.forEach(x => {
        const rail = railTemplate.clone();
        rail.position.set(x, 0.01, -60); 
        scene.add(rail);
        rails.push(rail);
    });
}

function showGameOver() {
    gameRunning = false;
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.padding = '20px';
    overlay.style.color = 'white';

    overlay.innerHTML = `
        <h2>Game Over</h2>
        <p>Score: ${Math.floor(score)}</p>
        <button onclick="location.reload()">Restart</button>
        <button onclick="this.parentElement.remove()">Stop</button>
    `;
    document.body.appendChild(overlay);
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameRunning) return;

    nextLeftBuildingZ += speed;
    nextRightBuildingZ += speed;

    while (nextLeftBuildingZ > -120 && buildingTemplates.length > 0) spawnBuildingSide('left');
    while (nextRightBuildingZ > -120 && buildingTemplates.length > 0) spawnBuildingSide('right');

    dayTime += 0.002; 
    const orbitRadius = 50; 

    sunSphere.position.x = Math.cos(dayTime) * orbitRadius;
    sunSphere.position.y = Math.sin(dayTime) * orbitRadius;
    sunSphere.position.z = -60; 

    moonSphere.position.x = Math.cos(dayTime + Math.PI) * orbitRadius;
    moonSphere.position.y = Math.sin(dayTime + Math.PI) * orbitRadius;
    moonSphere.position.z = -60;

    let sunHeightRatio = Math.max(0, Math.min(1, (sunSphere.position.y + orbitRadius/4) / (orbitRadius/2))); 
    scene.background.copy(nightSkyColor).lerp(daySkyColor, sunHeightRatio);

    // KÍCH HOẠT HIỆU ỨNG HIỆN/ẨN SAO VÀ MÂY
    if (starsMaterial) {
        starsMaterial.opacity = 1 - sunHeightRatio; // Tối mới hiện sao
    }
    if (cloudMaterial) {
        cloudMaterial.opacity = sunHeightRatio;     // Sáng mới hiện mây
    }

    if (sunSphere.position.y > moonSphere.position.y) {
        mainLight.position.copy(sunSphere.position);
        mainLight.color.setHex(0xfff5b6); 
        mainLight.intensity = 1.0;
    } else {
        mainLight.position.copy(moonSphere.position);
        mainLight.color.setHex(0xffffe0); 
        mainLight.intensity = 0.5; 
    }

    score += 0.1;
    scoreDiv.innerHTML = 'Score: ' + Math.floor(score);

    player.position.x = THREE.MathUtils.lerp(player.position.x, lane*2, 0.2);

    if (isJumping) {
        player.position.y += velocityY;
        velocityY += gravity;

        if (player.position.y <= 0.0) {
            player.position.y = 0.0;
            isJumping = false;
        }
    }

    const cameraTargetX = player.position.x;
    let cameraTargetY = player.position.y + 6; 
    let lookAtTargetY = player.position.y + 2; 

    if (isCrawling) {
        cameraTargetY = player.position.y + 4; 
        lookAtTargetY = player.position.y + 0.5;
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, 0.15);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTargetY, 0.15);
    camera.lookAt(player.position.x, lookAtTargetY, player.position.z - 20);

    obstacles.forEach((obs, index) => {
        obs.position.z += speed;

        const dz = Math.abs(obs.position.z - player.position.z);
        const dx = Math.abs(obs.position.x - player.position.x);

        const playerHitboxX = 0.3; 
        const playerHitboxZ = 0.3;
        
        const hitBoxTolerance = 0.15; 

        const obsHitbox = obs.userData.hitbox || { x: 0.75, z: 0.75 };

        if (dz < (obsHitbox.z + playerHitboxZ - hitBoxTolerance) && 
            dx < (obsHitbox.x + playerHitboxX - hitBoxTolerance)) {
            
            const type = obs.userData.type;

            if (type === 'train') showGameOver();
            if (type === 'low' && !isJumping) showGameOver();
            if (type === 'high' && !isCrawling) showGameOver(); 
        }

        if (obs.position.z > 10) {
            scene.remove(obs);
            obstacles.splice(index,1);
        }
    });

    buildings.forEach((b, index) => {
        b.position.z += speed;
        if (b.position.z > 40) { 
            scene.remove(b);
            buildings.splice(index,1);
        }
    });

    rails.forEach((r, index) => {
        r.position.z += speed;
        if (r.position.z > 20) {
            scene.remove(r);
            rails.splice(index, 1);
        }
    });

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});