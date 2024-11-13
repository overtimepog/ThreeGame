import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Cached objects and values
const _v3 = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _matrix4 = new THREE.Matrix4();
const _euler = new THREE.Euler();

// Scene variables
let scene, camera, renderer, mixer, sheep;
let animationActions = [];
let currentAction;
const moveSpeed = 0.05;
const clock = new THREE.Clock();
let cameraMode = 'back';
const planeSize = 20;
let compassElement;
const keysPressed = {};
let isMoving = false;
let movementAnimation = 'Roll';
let idleAnimation = 'Idle_A';

// Performance optimization
let lastCompassUpdate = 0;
const COMPASS_UPDATE_INTERVAL = 100; // ms

// Optimize with InstancedMesh for grass blades
function createGrassField() {
    // Create base plane with merged geometry for better performance
    const baseGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x2d5518, 
        shininess: 0,
        flatShading: true 
    });
    const basePlane = new THREE.Mesh(baseGeometry, baseMaterial);
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.receiveShadow = true;

    // Optimize grass instances
    const numBlades = 1000;
    const bladeGeometry = new THREE.PlaneGeometry(0.05, 0.4);
    const bladeMaterial = new THREE.MeshPhongMaterial({
        color: 0x33aa33,
        side: THREE.DoubleSide,
        flatShading: true
    });
    
    const instancedMesh = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, numBlades);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Pre-calculate matrices for better performance
    const position = _v3;
    const scale = new THREE.Vector3(1, 1, 1);
    
    for (let i = 0; i < numBlades; i++) {
        position.set(
            (Math.random() - 0.5) * planeSize,
            0,
            (Math.random() - 0.5) * planeSize
        );
        _quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
        _matrix4.compose(position, _quaternion, scale);
        instancedMesh.setMatrixAt(i, _matrix4);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    scene.add(basePlane);
    return instancedMesh;
}

function init() {
    // Preload assets
    const fbxLoader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();
    
    // Initialize scene with optimized settings
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    
    // Enable frustum culling
    scene.matrixAutoUpdate = false;

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 5, -10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 8, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const grassField = createGrassField();
    scene.add(grassField);

    const loader = new FBXLoader();
    loader.load(
        './Sheep_Animations.fbx',
        function (object) {
            object.scale.setScalar(0.02);
            object.position.y = 0;

            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(object);
            sheep = object;
            const animations = object.animations;
            addAnimation(object, animations);
            animControl(object);
            playAnimation(idleAnimation);
        },
        null,
        (error) => console.error('Error loading FBX:', error)
    );

    window.addEventListener('resize', onWindowResize, false);

    renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
    document.addEventListener('pointerlockchange', onPointerLockChange, false);

    window.addEventListener('keydown', (event) => keysPressed[event.code] = true, false);
    window.addEventListener('keyup', (event) => keysPressed[event.code] = false, false);

    compassElement = document.createElement('div');
    compassElement.style.position = 'absolute';
    compassElement.style.top = '10px';
    compassElement.style.right = '10px';
    compassElement.style.padding = '10px';
    compassElement.style.backgroundColor = '#333';
    compassElement.style.color = '#fff';
    compassElement.style.fontFamily = 'Arial, sans-serif';
    compassElement.style.fontSize = '14px';
    compassElement.style.borderRadius = '5px';
    compassElement.innerText = 'Direction: N';
    document.body.appendChild(compassElement);

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
        if (currentAction && currentAction.getClip().name === movementAnimation) {
            const progress = (currentAction.time / currentAction.getClip().duration) * 100;
            if (progress >= 100) {
                console.log(`| ${movementAnimation} animation loop completed |`);
                currentAction.time = 0; // Reset animation time to start from the beginning
                currentAction.play();
            }
        }
    }
    
    updateMovement();
    updateCamera();
    updateCompass();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Consolidate reusable vectors
const moveDirection = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
function updateMovement() {
    if (!sheep) return;
    const direction = moveDirection.set(0, 0, 0);
    if (keysPressed['KeyW']) direction.z += 1;
    if (keysPressed['KeyS']) direction.z -= 1;
    if (keysPressed['KeyA']) direction.x -= 1;
    if (keysPressed['KeyD']) direction.x += 1;

    const wasMoving = isMoving;
    if (direction.lengthSq() > 0) {
        direction.normalize();
        const rotatedDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), sheep.rotation.y);
        sheep.position.addScaledVector(rotatedDirection, moveSpeed);
        isMoving = true;
    } else {
        isMoving = false;
    }

    if (isMoving !== wasMoving) {
        if (isMoving) {
            console.log(`Starting ${movementAnimation} animation`);
            stopAnimations();
            animationsSelect.value = movementAnimation;
            playAnimation();
        } else {
            console.log(`Stopping ${movementAnimation} animation, playing Idle`);
            stopAnimations(); 
            animationsSelect.value = idleAnimation;
            playAnimation();
        }
    }
}

function updateCamera() {
    if (!sheep) return;
    const offset = cameraMode === 'back' ? new THREE.Vector3(0, 4.2, -4.5) : new THREE.Vector3(0, 4.2, 4.5);
    const relativeOffset = offset.applyQuaternion(sheep.quaternion);
    camera.position.lerp(cameraOffset.copy(sheep.position).add(relativeOffset), 0.1);
    camera.lookAt(sheep.position.x, sheep.position.y + 1, sheep.position.z);
}

function updateCompass() {
    if (!sheep) return;
    
    const now = performance.now();
    if (now - lastCompassUpdate < COMPASS_UPDATE_INTERVAL) return;
    
    _v3.set(0, 0, -1).applyQuaternion(sheep.quaternion);
    compassElement.innerText = `Direction: ${_v3.z > 0 ? 'S' : 'N'}`;
    lastCompassUpdate = now;
}

// Animation control is now handled by stuff.js

function getAnimationList() {
    return animationActions.map((item, index) => ({
        index: index,
        name: item.name
    }));
}

function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        document.removeEventListener('mousemove', onMouseMove, false);
    }
}

function onMouseMove(event) {
    const movementX = event.movementX || 0;
    if (sheep) {
        const rotationSpeed = 0.002;
        sheep.rotation.y -= movementX * rotationSpeed;
    }
}

init();
