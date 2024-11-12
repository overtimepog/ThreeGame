import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let scene, camera, renderer, mixer, sheep;
let animationActions = []; // Array to store all animation actions
let currentAction; // Variable to keep track of current action
const moveSpeed = 0.05; // Speed of the sheep movement
const clock = new THREE.Clock(); // Clock for delta time calculation
let cameraMode = 'back'; // Camera mode to switch between front and back views
const planeSize = 20; // Size of the plane
let compassElement;
const keysPressed = {};
let isMoving = false; // Variable to track if the sheep is currently moving

// Optimize with InstancedMesh for grass blades
function createGrassField() {
    const baseGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x2d5518, shininess: 0 });
    const basePlane = new THREE.Mesh(baseGeometry, baseMaterial);
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.receiveShadow = true;

    const numBlades = 1000;
    const bladeHeight = 0.4;
    const bladeWidth = 0.05;
    const geometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
    const material = new THREE.MeshPhongMaterial({
        color: 0x33aa33,
        side: THREE.DoubleSide,
        flatShading: true
    });
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, numBlades);
    for (let i = 0; i < numBlades; i++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * planeSize,
            0,
            (Math.random() - 0.5) * planeSize
        );
        const rotation = Math.random() * Math.PI;

        const matrix = new THREE.Matrix4();
        matrix.compose(position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation), new THREE.Vector3(1, 1, 1));
        instancedMesh.setMatrixAt(i, matrix);
    }

    scene.add(basePlane);
    return instancedMesh;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

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
            mixer = new THREE.AnimationMixer(object);
            const animations = object.animations;
            if (animations && animations.length > 0) {
                animations.forEach((animation) => {
                    const action = mixer.clipAction(animation);
                    action.loop = THREE.LoopRepeat;
                    action.timeScale = 1.0;
                    animationActions.push({ name: animation.name, action: action });
                });
            }
            playAnimation('Idle_A');
        },
        (xhr) => console.log('Loading progress:', (xhr.loaded / xhr.total * 100) + '%'),
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
    if (mixer) mixer.update(delta);
    
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
        playAnimation(isMoving ? 'Walk' : 'Idle_A');
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
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(sheep.quaternion);
    compassElement.innerText = `Direction: ${direction.z > 0 ? 'S' : 'N'}`;
}

function playAnimation(animationName, options = {}) {
    if (!mixer) return;

    const {
        timeScale = 1.0,
        fadeInTime = 0.3,
        fadeOutTime = 0.3,
        repetitions = Infinity,
        clampWhenFinished = false
    } = options;

    const newActionData = animationActions.find(a => a.name === animationName);
    if (!newActionData) return;

    const newAction = newActionData.action;

    if (currentAction === newAction) return;

    if (currentAction) {
        currentAction.crossFadeTo(newAction, fadeOutTime, false);
    }

    if (animationName === 'Walk') {
        const originalDuration = newAction.getClip().duration;
        const desiredDuration = 0.42;
        const adjustedTimeScale = originalDuration / desiredDuration;
        newAction.setEffectiveTimeScale(adjustedTimeScale);

        newAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
        newAction.setEffectiveTimeScale(timeScale);
        newAction.setLoop(THREE.LoopRepeat, repetitions);
    }

    newAction.clampWhenFinished = clampWhenFinished;
    newAction.play();

    currentAction = newAction;
}

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