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

function createGrassBlade() {
    const bladeHeight = 0.4;
    const bladeWidth = 0.05;
    const geometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
    const material = new THREE.MeshPhongMaterial({
        color: 0x33aa33,
        side: THREE.DoubleSide,
        flatShading: true
    });

    const blade = new THREE.Mesh(geometry, material);
    blade.geometry.translate(0, bladeHeight / 2, 0); // Move the blade's base to y=0
    return blade;
}

function createGrassField() {
    const baseGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x2d5518,
        shininess: 0
    });
    const basePlane = new THREE.Mesh(baseGeometry, baseMaterial);
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.receiveShadow = true;

    const grassGroup = new THREE.Group();

    const numBlades = 1000; // Number of grass blades
    for (let i = 0; i < numBlades; i++) {
        const blade = createGrassBlade();
        blade.position.set(
            (Math.random() - 0.5) * planeSize,
            0,
            (Math.random() - 0.5) * planeSize
        );
        blade.rotation.y = Math.random() * Math.PI; // Random rotation for natural look
        grassGroup.add(blade);
    }

    // Add the base plane separately to the scene
    scene.add(basePlane);

    return grassGroup;
}

function animateGrass(grassGroup) {
    const time = performance.now() * 0.001;
    grassGroup.children.forEach((blade, index) => {
        if (blade.isMesh) {
            const sway = Math.sin(time * 2 + index) * 0.1; // Adjust for desired effect
            blade.rotation.z = sway;
        }
    });
}

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

    // Adjust the initial camera position
    camera.position.set(0, 5, -10);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 8, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Create and add grass field
    const grassField = createGrassField();
    scene.add(grassField);

    // Load FBX Model
    const loader = new FBXLoader();
    loader.load(
        './Sheep_Animations.fbx',
        function (object) {
            console.log('FBX file loaded:', object);

            // Scale and position the model
            object.scale.setScalar(0.02);
            object.position.y = 0;

            // Enable shadows
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(object);
            sheep = object; // Store reference to the sheep object

            // Setup animation mixer
            mixer = new THREE.AnimationMixer(object);

            // Store all animations in the array
            const animations = object.animations;
            if (animations && animations.length > 0) {
                animations.forEach((animation) => {
                    const action = mixer.clipAction(animation);
                    action.loop = THREE.LoopRepeat;
                    action.clampWhenFinished = false;

                    // Set up action properties
                    action.timeScale = 1.0;
                    action.enabled = true;
                    action.setEffectiveWeight(1);
                    action.setLoop(THREE.LoopRepeat, Infinity);

                    console.log(`Animation: ${animation.name}, Duration: ${animation.duration.toFixed(2)} seconds`);

                    animationActions.push({
                        name: animation.name,
                        action: action
                    });
                });
            }

            // Log the loaded animations
            const animationList = getAnimationList();
            console.log('Available animations:', animationList);

            // Start with Idle animation
            playAnimation('Idle_A');
        },
        // Progress callback
        function (xhr) {
            console.log('Loading progress:', (xhr.loaded / xhr.total * 100) + '%');
        },
        // Error callback
        function (error) {
            console.error('Error loading FBX:', error);
        }
    );

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Add pointer lock setup
    renderer.domElement.addEventListener('click', function () {
        renderer.domElement.requestPointerLock();
    }, false);

    document.addEventListener('pointerlockchange', onPointerLockChange, false);

    // Replace single keydown event with continuous key tracking
    window.addEventListener('keydown', (event) => {
        // Use event.code for reliable key detection
        keysPressed[event.code] = true;
    }, false);

    window.addEventListener('keyup', (event) => {
        keysPressed[event.code] = false;
    }, false);

    // Create compass element
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

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();

        if (mixer) {
            mixer.update(delta);
        }

        animateGrass(grassField);
        updateMovement();
        updateCamera();
        updateCompass();

        renderer.render(scene, camera);
    }

    animate();
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;

    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateMovement() {
    if (!sheep) return;

    const direction = new THREE.Vector3();

    if (keysPressed['KeyW']) {
        direction.z += 1;
    }
    if (keysPressed['KeyS']) {
        direction.z -= 1;
    }
    if (keysPressed['KeyA']) {
        direction.x -= 1;
    }
    if (keysPressed['KeyD']) {
        direction.x += 1;
    }

    const wasMoving = isMoving;

    if (direction.lengthSq() > 0) {
        direction.normalize();

        // Rotate the direction vector by the sheep's rotation
        const moveDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sheep.rotation.y);

        sheep.position.addScaledVector(moveDirection, moveSpeed);
        isMoving = true;
    } else {
        isMoving = false;
    }

    // Only change animation when movement state changes
    if (isMoving !== wasMoving) {
        if (isMoving) {
            playAnimation('Walk'); // Start 'Walk' animation
        } else {
            playAnimation('Idle_A'); // Transition to 'Idle_A' when stopping
        }
    }
}

function updateCamera() {
    if (!sheep) return;

    let offset;
    if (cameraMode === 'back') {
        offset = new THREE.Vector3(0, 4.2, -4.5); // Back view offset for third-person view
    } else if (cameraMode === 'front') {
        offset = new THREE.Vector3(0, 4.2, 4.5); // Front view offset for third-person view
    }

    // Apply the offset to the sheep's current orientation
    const relativeOffset = offset.clone().applyQuaternion(sheep.quaternion);
    const cameraPosition = new THREE.Vector3().copy(sheep.position).add(relativeOffset);
    camera.position.lerp(cameraPosition, 0.1);

    // Keep the camera looking at the sheep's position
    camera.lookAt(sheep.position.x, sheep.position.y + 1, sheep.position.z); // Adjust y for a better view angle
}

function updateCompass() {
    if (!sheep) return;

    // Get the direction the sheep is facing
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(sheep.quaternion);
    let compassDirection = 'N';

    if (Math.abs(direction.x) > Math.abs(direction.z)) {
        if (direction.x > 0) {
            compassDirection = 'E';
        } else {
            compassDirection = 'W';
        }
    } else {
        if (direction.z > 0) {
            compassDirection = 'S';
        } else {
            compassDirection = 'N';
        }
    }

    compassElement.innerText = `Direction: ${compassDirection}`;
}

// Function to play a specific animation by name
function playAnimation(animationName, options = {}) {
    if (!mixer) return;

    const {
        timeScale = 1.0,         // Speed of the animation
        fadeInTime = 0.3,        // Duration of fade in transition
        fadeOutTime = 0.3,       // Duration of fade out transition
        repetitions = Infinity,  // Number of times to repeat
        clampWhenFinished = false // Whether to freeze on last frame
    } = options;

    const newActionData = animationActions.find(a => a.name === animationName);
    if (!newActionData) return;

    const newAction = newActionData.action;

    // If the new action is already the current action, do nothing
    if (currentAction === newAction) {
        return;
    }

    // Crossfade to the new action
    if (currentAction) {
        currentAction.crossFadeTo(newAction, fadeOutTime, false);
    }

    if (animationName === 'Walk') {
        // Adjust timeScale so that 'Walk' animation lasts 0.42 seconds per loop
        const originalDuration = newAction.getClip().duration;
        const desiredDuration = 0.42; // seconds
        const adjustedTimeScale = originalDuration / desiredDuration;
        newAction.setEffectiveTimeScale(adjustedTimeScale);

        newAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
        newAction.setEffectiveTimeScale(timeScale);
        newAction.setLoop(THREE.LoopRepeat, repetitions);
    }

    newAction.clampWhenFinished = clampWhenFinished;
    newAction.play();

    currentAction = newAction; // Update the currentAction
}

function getAnimationList() {
    return animationActions.map((item, index) => ({
        index: index,
        name: item.name
    }));
}

function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        console.log('Pointer locked');
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        console.log('Pointer unlocked');
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
