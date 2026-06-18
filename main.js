// 1. IMPORT THƯ VIỆN
// Sử dụng CDN để tải các module của Three.js
// 1. IMPORT THƯ VIỆN
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 2. KHAI BÁO CÁC THỰC THỂ (ENTITIES) CƠ BẢN
// Kiến thức ĐHMT: Bất kỳ ứng dụng 3D nào cũng cần 3 yếu tố cốt lõi: 
// Scene (Không gian chứa), Camera (Góc nhìn), và Renderer (Bộ xuất hình ảnh).
let scene, camera, renderer;

// Khai báo các đối tượng trong game
let player, obstacles = [], buildings = [], rails = []; 
let speed = 0.25;
let lane = 0; // Trục X phân làn (-2, 0, 2)
let score = 0;
let scoreDiv;
let gameRunning = true;

// Các biến quản lý Animation cho Model
let mixer; // Quản lý hoạt ảnh (Animation)
const clock = new THREE.Clock(); // Đồng hồ đếm thời gian thực cho Animation

// Các biến lưu trữ Template (Bản mẫu) của Model 3D để nhân bản (Clone)
let tramModelTemplate = null;
let barricadeModelTemplate = null;
let highBarricadeTemplate = null; 
let railTemplate = null; 
let buildingTemplates = []; 

// Trạng thái nhân vật
let isJumping = false;
let isCrawling = false;
let velocityY = 0;
// Kiến thức ĐHMT / Vật lý: Trọng lực kéo đối tượng xuống dọc theo trục Y âm.
const gravity = -0.02; 

// Các thực thể môi trường (Mặt trời, Mặt trăng, Ánh sáng)
let sunSphere, moonSphere;
let mainLight;
let dayTime = 0; 
const daySkyColor = new THREE.Color(0x87ceeb); 
const nightSkyColor = new THREE.Color(0x00000c); 

// Vật liệu cho các hệ thống hạt (Particles) và Mây
let starsMaterial;
let cloudMaterial;

// Quản lý vị trí sinh ra các tòa nhà tiếp theo (Z-axis)
let nextLeftBuildingZ = 20;
let nextRightBuildingZ = 20;

// 3. KHỞI CHẠY CHƯƠNG TRÌNH
init();
animate();

function init() {
    // 4. KHỞI TẠO SCENE
    // Kiến thức ĐHMT: Scene graph là cấu trúc dữ liệu dạng cây chứa mọi đối tượng 3D, đèn, và camera.
    scene = new THREE.Scene();
    scene.background = nightSkyColor.clone();

    // 5. KHỞI TẠO CAMERA
    // Kiến thức ĐHMT: Perspective Camera tạo ra hiệu ứng phối cảnh (vật ở xa trông nhỏ hơn).
    // Tham số: Góc nhìn FOV (75 độ), Tỉ lệ khung hình (Aspect Ratio), Near clipping plane (0.1), Far clipping plane (1000).
    // Những vật nằm ngoài khoảng Near-Far sẽ bị loại bỏ để tiết kiệm tài nguyên (Frustum Culling).
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 12);

    // 6. KHỞI TẠO RENDERER
    // Kiến thức ĐHMT: WebGLRenderer chuyển đổi dữ liệu hình học 3D thành các pixel 2D trên màn hình (Rasterization).
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    
    // Bật bóng đổ (Shadow Mapping)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Làm mềm viền bóng đổ
    document.body.appendChild(renderer.domElement);

    // 7. TẠO HỆ THỐNG HẠT (PARTICLE SYSTEM) - CÁC VÌ SAO
    // Kiến thức ĐHMT: Point Cloud dùng để vẽ hàng nghìn đỉnh nhỏ mà không tốn nhiều chi phí render như các khối Mesh.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 20;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 300;     
        starPos[i * 3 + 1] = 10 + Math.random() * 100;    
        starPos[i * 3 + 2] = -50 - Math.random() * 150;   
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, size: 0.7, transparent: true, opacity: 0 
    });
    const stars = new THREE.Points(starGeo, starsMaterial);
    scene.add(stars);

    // 8. TẠO MÔI TRƯỜNG - MÂY
    const clouds = new THREE.Group();
    // MeshStandardMaterial: Vật liệu phản ứng với ánh sáng (PBR - Physically Based Rendering)
    cloudMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, transparent: true, opacity: 1, flatShading: true 
    });
    
    function createCloud() {
        const cloudGroup = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(2, 8, 8);
        
        // Nhóm các hình cầu lại để tạo thành hình đám mây (Constructive Solid Geometry dạng đơn giản bằng Group)
        const m1 = new THREE.Mesh(sphereGeo, cloudMaterial);
        m1.position.set(0, 0, 0); m1.scale.set(1.5, 1.5, 1.5); cloudGroup.add(m1);
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

    // 9. THỰC THỂ CHIẾU SÁNG & BẦU TRỜI
    const celestialGeometry = new THREE.SphereGeometry(4, 16, 16);

    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 }); 
    moonSphere = new THREE.Mesh(celestialGeometry, moonMaterial);
    scene.add(moonSphere);

    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5b6 }); 
    sunSphere = new THREE.Mesh(celestialGeometry, sunMaterial);
    scene.add(sunSphere);

    // Kiến thức ĐHMT: Directional Light mô phỏng ánh sáng mặt trời, chiếu song song.
    mainLight = new THREE.DirectionalLight(0xffffff, 1); 
    mainLight.castShadow = true;
    // Cấu hình vùng tạo bóng (Shadow Camera)
    mainLight.shadow.camera.top = 50; 
    mainLight.shadow.camera.bottom = -50; 
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 150; 
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Ambient Light tạo ánh sáng nền nhẹ để phần tối không bị đen đặc.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    // 10. TẢI CÁC MODEL 3D (GLTF/GLB)
    const loader = new GLTFLoader();

    // Tòa nhà
    const targetBuildingHeight = 12; 
    const buildingFiles = ['glb_model/b1.glb', 'glb_model/b2.glb']; 
    
    buildingFiles.forEach((file) => {
        loader.load(
            file,
            function (gltf) {
                const model = gltf.scene;
                model.name = file; 
                
                // Tính toán Bounding Box (AABB) để xác định kích thước thật của Model
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);

                // Đồng bộ hóa tỉ lệ Scale
                const scaleFactor = targetBuildingHeight / size.y;
                model.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const newBox = new THREE.Box3().setFromObject(model);
                model.position.y -= newBox.min.y; 

                // Xử lý Mesh con (Child nodes)
                model.traverse(function (child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    if (child.isLight) {
                        child.intensity = 0;
                        child.visible = false;
                    }
                });
                buildingTemplates.push(model);
            },
            undefined,
            function (error) { console.error(`Lỗi khi load ${file}:`, error); }
        );
    });

    // 11. GIAO DIỆN NGƯỜI DÙNG (UI)
    scoreDiv = document.createElement('div');
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '10px';
    scoreDiv.style.left = '10px';
    scoreDiv.style.color = 'white';
    scoreDiv.style.fontSize = '24px';
    scoreDiv.style.fontWeight = 'bold'; 
    scoreDiv.innerHTML = 'Score: 0';
    document.body.appendChild(scoreDiv);

    // 12. THỰC THỂ MẶT ĐẤT
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 200),
        new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.8}) 
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.z = -50;
    ground.receiveShadow = true;
    scene.add(ground);

    // 13. TẢI NHÂN VẬT & CHƯỚNG NGẠI VẬT
    player = new THREE.Group();
    player.position.y = 0.0;
    scene.add(player);

    loader.load(
            'glb_model/Man2.glb',
            function (gltf) {
                const model = gltf.scene;

                let s = 0.5
                model.scale.set(s, s, s);
                model.rotation.y = Math.PI;

                const box = new THREE.Box3().setFromObject(model);
                model.position.set(0, -box.min.y, 0);
                model.position.set(0, 0, 0);

                model.traverse(function (child) {
                    if (child.isMesh || child.isSkinnedMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.frustumCulled = false; 

                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                mat.transparent = false; 
                                mat.depthWrite = true;
                                mat.alphaTest = 0.5;
                            });
                        }
                    }
                });

                // 4. CHẠY ANIMATION
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    const runAction = mixer.clipAction(gltf.animations[0]);
                    runAction.play();
                }

                player.add(model);
            },
            undefined,
            function (error) {
                console.error("LỖI KHÔNG THỂ LOAD MODEL:", error);
            }
        );

    // Load Tàu, Rào thấp, Rào cao, Đường ray...
    loader.load('glb_model/Tram.glb', function (gltf) {
        tramModelTemplate = gltf.scene;
        const box = new THREE.Box3().setFromObject(tramModelTemplate);
        const size = new THREE.Vector3(); box.getSize(size);
        const scaleFactor = 5.0 / size.y;
        tramModelTemplate.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const newBox = new THREE.Box3().setFromObject(tramModelTemplate);
        tramModelTemplate.position.y -= newBox.min.y;
        tramModelTemplate.rotation.y = Math.PI / 2;
        tramModelTemplate.traverse(function (child) {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            if (child.isLight) { child.intensity = 0; child.visible = false; }
        });
    });

    loader.load('glb_model/low_b.glb', function (gltf) {
        barricadeModelTemplate = gltf.scene;
        const box = new THREE.Box3().setFromObject(barricadeModelTemplate);
        const size = new THREE.Vector3(); box.getSize(size);
        const scaleFactor = 1.0 / size.y;
        barricadeModelTemplate.scale.set(scaleFactor, scaleFactor, scaleFactor);
        barricadeModelTemplate.rotation.y = - Math.PI / 2;
        const newBox = new THREE.Box3().setFromObject(barricadeModelTemplate);
        barricadeModelTemplate.position.y -= newBox.min.y; 
        barricadeModelTemplate.traverse(function (child) {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            if (child.isLight) child.intensity = 0;
        });
    });

    loader.load('glb_model/high_b.glb', function (gltf) {
        highBarricadeTemplate = gltf.scene;
        const box = new THREE.Box3().setFromObject(highBarricadeTemplate);
        const size = new THREE.Vector3(); box.getSize(size);
        const scaleFactor = 2.5 / size.y;
        highBarricadeTemplate.scale.set(scaleFactor, scaleFactor, scaleFactor);
        highBarricadeTemplate.rotation.y = - Math.PI / 2; 
        const newBox = new THREE.Box3().setFromObject(highBarricadeTemplate);
        highBarricadeTemplate.position.y -= newBox.min.y; 
        highBarricadeTemplate.traverse(function (child) {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            if (child.isLight) child.intensity = 0;
        });
    });

    loader.load('glb_model/rail.glb', function (gltf) {
        railTemplate = gltf.scene;
        const box = new THREE.Box3().setFromObject(railTemplate);
        const size = new THREE.Vector3(); box.getSize(size);
        const targetLength = 15;
        const scaleZ = size.z > 0 ? targetLength / size.z : 1;
        railTemplate.scale.set(2, 1, scaleZ); 
        const newBox = new THREE.Box3().setFromObject(railTemplate);
        railTemplate.position.y -= newBox.min.y; 
        railTemplate.traverse(function (child) {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
    });

    // 14. LẮNG NGHE SỰ KIỆN PHÍM (INPUT)
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
            // Kiến thức ĐHMT: Ma trận xoay. Dùng Euler angles để lật Model vuông góc với mặt phẳng.
            player.rotation.x = Math.PI / 2; 

            setTimeout(() => {
                isCrawling = false;
                player.rotation.x = 0; 
            }, 600);
        }
    });

    // 15. BỘ ĐẾM THỜI GIAN (TIMERS) SINH VẬT THỂ
    setInterval(() => { if (gameRunning) spawnObstacle(); }, 800);
    setInterval(() => { if (gameRunning) spawnRails(); }, 800);
}

// 16. HÀM TÍNH TOÁN HITBOX
// Kiến thức ĐHMT: Axis-Aligned Bounding Box (AABB).
// Tính toán kích thước khối hộp bao quanh object để phục vụ xét va chạm (Collision Detection).
function calculateHitbox(object) {
    object.updateMatrixWorld(true); 
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { x: size.x / 2, z: size.z / 2 };
}

// 17. HÀM SINH CHƯỚNG NGẠI VẬT (OBSTACLES)
function spawnObstacle() {
    const type = Math.random();

    if (type < 0.4) {
        let train = tramModelTemplate ? tramModelTemplate.clone() : new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1.5, 1.5),
            new THREE.MeshStandardMaterial({color: 0x2222ff})
        );
        if (!tramModelTemplate) { train.castShadow = true; train.receiveShadow = true; train.position.y = 1.25; }

        train.userData.type = 'train';
        const lanePos = [-4,0,4][Math.floor(Math.random()*3)];
        train.position.set(lanePos, train.position.y, -60);
        train.userData.hitbox = calculateHitbox(train);

        scene.add(train);
        obstacles.push(train);
    }
    else if (type < 0.7) {
        let low = barricadeModelTemplate ? barricadeModelTemplate.clone() : new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.7, 2),
            new THREE.MeshStandardMaterial({color: 0xffff00})
        );
        if(!barricadeModelTemplate){ low.castShadow = true; low.receiveShadow = true; low.position.y = 0.35; }

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

// 18. HÀM SINH TÒA NHÀ (MÔI TRƯỜNG NỀN)
function spawnBuildingSide(side) {
    const targetLeftEdge = -6.5; 
    const targetRightEdge = 6.5; 

    if(buildingTemplates.length === 0) return;
    const randomIndex = Math.floor(Math.random() * buildingTemplates.length);
    let b = buildingTemplates[randomIndex].clone();
    b.position.set(0, 0, 0); 

    // Điều chỉnh xoay (Rotation) tùy theo phía để mặt tiền hướng ra đường
    if (side === 'left') {
        switch (b.name) {
            case 'glb_model/b1.glb': b.rotation.y = 2 * Math.PI; break;
            case 'glb_model/b2.glb': b.rotation.y = 0; b.position.y = 6; break;
            case 'glb_model/b3.glb': b.rotation.y = -Math.PI / 2; break;
            default: b.rotation.y = 0; break;
        }
    } else {
        switch (b.name) {
            case 'glb_model/b1.glb': b.rotation.y = Math.PI; break;
            case 'glb_model/b2.glb': b.rotation.y = Math.PI; b.position.y = 6; break;
            case 'glb_model/b3.glb': b.rotation.y = Math.PI / 2; break;
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

// 19. HÀM SINH ĐƯỜNG RAY
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

// 20. HÀM XỬ LÝ KẾT THÚC TRÒ CHƠI
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

// 21. VÒNG LẶP RENDER (GAME LOOP)
// Kiến thức ĐHMT: Đây là trái tim của game. `requestAnimationFrame` đồng bộ với 
// tần số quét của màn hình (thường là 60fps), tính toán lại logic và gọi Draw Call liên tục.
function animate() {
    requestAnimationFrame(animate);

    if (!gameRunning) return;

    // CẬP NHẬT ANIMATION MODEL CHO MỖI FRAME
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    nextLeftBuildingZ += speed;
    nextRightBuildingZ += speed;

    while (nextLeftBuildingZ > -120 && buildingTemplates.length > 0) spawnBuildingSide('left');
    while (nextRightBuildingZ > -120 && buildingTemplates.length > 0) spawnBuildingSide('right');

    // Cập nhật Chu kỳ Ngày/Đêm (Day/Night Cycle)
    dayTime += 0.002; 
    const orbitRadius = 50; 
    sunSphere.position.x = Math.cos(dayTime) * orbitRadius;
    sunSphere.position.y = Math.sin(dayTime) * orbitRadius;
    sunSphere.position.z = -60; 

    moonSphere.position.x = Math.cos(dayTime + Math.PI) * orbitRadius;
    moonSphere.position.y = Math.sin(dayTime + Math.PI) * orbitRadius;
    moonSphere.position.z = -60;

    let sunHeightRatio = Math.max(0, Math.min(1, (sunSphere.position.y + orbitRadius/4) / (orbitRadius/2))); 
    scene.background.copy(nightSkyColor).lerp(daySkyColor, sunHeightRatio); // Nội suy màu sắc Lerp (Linear Interpolation)

    if (starsMaterial) starsMaterial.opacity = 1 - sunHeightRatio; 
    if (cloudMaterial) cloudMaterial.opacity = sunHeightRatio;     

    if (sunSphere.position.y > moonSphere.position.y) {
        mainLight.position.copy(sunSphere.position);
        mainLight.color.setHex(0xfff5b6); 
        mainLight.intensity = 1.0;
    } else {
        mainLight.position.copy(moonSphere.position);
        mainLight.color.setHex(0xffffe0); 
        mainLight.intensity = 0.5; 
    }

    // Cập nhật điểm
    score += 0.1;
    const newScore = Math.floor(score);
    if (newScore !== scoreDiv._lastScore) {
        scoreDiv.textContent = 'Score: ' + newScore;
        scoreDiv._lastScore = newScore;
    }

    // Cập nhật Vị trí & Vật lý nhân vật (Player Transformation & Physics)
    player.position.x = THREE.MathUtils.lerp(player.position.x, lane*2, 0.2); // Di chuyển mượt (Lerp)

    if (isJumping) {
        player.position.y += velocityY;
        velocityY += gravity; // Phương trình chuyển động ném xiên đơn giản

        if (player.position.y <= 0.0) {
            player.position.y = 0.0;
            isJumping = false;
        }
    }

    // Camera chạy theo nhân vật
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

    // 22. XỬ LÝ VA CHẠM (COLLISION DETECTION)
    // Duyệt qua tất cả các chướng ngại vật
    obstacles.forEach((obs, index) => {
        obs.position.z += speed; // Di chuyển lại gần camera để tạo cảm giác nhân vật đang chạy

        const dz = Math.abs(obs.position.z - player.position.z);
        const dx = Math.abs(obs.position.x - player.position.x);

        const playerHitboxX = 0.3; 
        const playerHitboxZ = 0.3;
        const hitBoxTolerance = 0.15; 

        const obsHitbox = obs.userData.hitbox || { x: 0.75, z: 0.75 };

        // Kiểm tra Box giao nhau (Intersection)
        if (dz < (obsHitbox.z + playerHitboxZ - hitBoxTolerance) && 
            dx < (obsHitbox.x + playerHitboxX - hitBoxTolerance)) {
            
            const type = obs.userData.type;

            if (type === 'train') showGameOver();
            if (type === 'low' && !isJumping) showGameOver();
            if (type === 'high' && !isCrawling) showGameOver(); 
        }

        // Xóa các vật thể đã ra khỏi khung hình để giải phóng RAM (Object Pooling / Disposal)
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

    // Xuất frame ra màn hình
    renderer.render(scene, camera);
}

// 23. XỬ LÝ THAY ĐỔI KÍCH THƯỚC CỬA SỔ
window.addEventListener('resize', () => {
    // Kiến thức ĐHMT: Khi màn hình thay đổi, Aspect Ratio của Perspective Camera phải được tính toán lại.
    // Nếu không cập nhật Projection Matrix, hình ảnh sẽ bị kéo giãn hoặc bóp méo.
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});