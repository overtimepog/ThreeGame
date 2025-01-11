import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let scene, camera, renderer, mixer;
let currentModel;
let animationActions = {}; // Object to store all animation actions
let currentAction; // Variable to keep track of current action
const moveSpeed = 0.08;
const clock = new THREE.Clock();
let cameraMode = 'back';
const planeSize = 20;
let compassElement;
const keysPressed = {};

let modelConfig = null;
let currentModelType = 'chicken'; // Default model type

async function loadModelConfig() {
    try {
        const response = await fetch('./models_config.json');
        modelConfig = await response.json();
        return modelConfig;
    } catch (error) {
        console.error('Error loading model config:', error);
    }
}

async function loadModel(modelType) {
    if (!modelConfig) {
        await loadModelConfig();
    }

    const config = modelConfig[modelType];
    if (!config) {
        console.error(`Model type ${modelType} not found in config`);
        return;
    }

    // Determine loader based on file extension
    const modelPath = config.model;
    const isGLTF = modelPath.toLowerCase().endsWith('.gltf') || modelPath.toLowerCase().endsWith('.glb');
    const isFBX = modelPath.toLowerCase().endsWith('.fbx');
    
    let loader;
    if (isGLTF) {
        loader = new GLTFLoader();
    } else if (isFBX) {
        loader = new FBXLoader();
    } else {
        console.error('Unsupported model format');
        return;
    }

    // Load the model
    try {
        const model = await new Promise((resolve, reject) => {
            loader.load(config.model,
                (result) => {
                    // GLTFLoader returns { scene }, FBXLoader returns the model directly
                    resolve(isGLTF ? result.scene : result);
                },
                undefined,
                (error) => reject(error)
            );
        });

        currentModel = model;
        currentModel.scale.setScalar(config.scale);
        currentModel.position.y = 0;

        currentModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(currentModel);

        // Create animation mixer
        mixer = new THREE.AnimationMixer(currentModel);
        animationActions = {};

        // Load all animations using GLTFLoader since animations are in GLB format
        const animLoader = new GLTFLoader();
        const animationPromises = Object.entries(config.animations).map(([animName, animPath]) => {
            return new Promise((resolve, reject) => {
                animLoader.load(animPath,
                    (gltf) => {
                        const animation = gltf.animations[0];
                        const action = mixer.clipAction(animation);
                        animationActions[animName] = action;
                        resolve();
                    },
                    undefined,
                    reject
                );
            });
        });

        await Promise.all(animationPromises);
        
        // Start with idle animation
        playAnimation('idle', { repetitions: Infinity });

    } catch (error) {
        console.error('Error loading model or animations:', error);
    }
}

function playAnimation(animationName, options = {}) {
    console.log(`Attempting to play animation: ${animationName}`);
    
    if (mixer && animationActions[animationName]) {
        if (currentAction) {
            const progress = currentAction.time / currentAction.getClip().duration;
            currentAction.fadeOut(0.2);
            
            let action = animationActions[animationName];
            if (options.repetitions !== undefined) {
                action.setLoop(THREE.LoopRepeat, options.repetitions);
            }
            action.reset().fadeIn(0.2).play();
            action.time = progress * action.getClip().duration;
            currentAction = action;
        } else {
            let action = animationActions[animationName];
            if (options.repetitions !== undefined) {
                action.setLoop(THREE.LoopRepeat, options.repetitions);
            }
            action.reset().fadeIn(0.2).play();
            currentAction = action;
        }
    } else {
        console.warn('Could not play animation - mixer or action not found');
    }
}

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

function reloadScene() {
    // Remove existing scene elements
    if (scene) {
        scene.clear();
        mixer = null;
        currentModel = null;
        animationActions = {};
        currentAction = null;
    }
    
    // Remove and reload the script
    const oldScript = document.querySelector('script[src="main.js"]');
    if (oldScript) {
        oldScript.remove();
    }
    
    const newScript = document.createElement('script');
    newScript.type = 'module';
    newScript.src = 'main.js?' + Date.now(); // Add timestamp to bypass cache
    document.body.appendChild(newScript);
}

function init() {
    // Add reload button event listener
    document.getElementById('reloadButton').addEventListener('click', reloadScene);
    
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

    // Load the default model
    loadModel(currentModelType);

    setupEventListeners();
    animate();
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    window.addEventListener('keydown', (event) => keysPressed[event.code] = true, false);
    window.addEventListener('keyup', (event) => keysPressed[event.code] = false, false);

    setupCompass();
}

function setupCompass() {
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
}

function animate() {
    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 1000 / 45); // Limit frame rate to 30 FPS

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

// Update movement function for the new system
function updateMovement() {
    if (!currentModel) return;
    const direction = new THREE.Vector3(0, 0, 0);
    if (keysPressed['KeyW']) direction.z += 1;
    if (keysPressed['KeyS']) direction.z -= 1;
    if (keysPressed['KeyA']) direction.x -= 1;
    if (keysPressed['KeyD']) direction.x += 1;

    if (direction.lengthSq() > 0) {
        if (currentAction && currentAction !== animationActions.walk) {
            playAnimation('walk', { repetitions: Infinity });
        }
    } else {
        if (currentAction && currentAction !== animationActions.idle) {
            playAnimation('idle', { repetitions: Infinity });
        }
    }

    if (direction.lengthSq() > 0) {
        direction.normalize();
        const rotatedDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentModel.rotation.y);
        currentModel.position.addScaledVector(rotatedDirection, moveSpeed);
    }
}

// Update camera function for the new system
function updateCamera() {
    if (!currentModel) return;
    const offset = cameraMode === 'back' ? new THREE.Vector3(0, 4.2, -4.5) : new THREE.Vector3(0, 4.2, 4.5);
    const relativeOffset = offset.applyQuaternion(currentModel.quaternion);
    camera.position.lerp(new THREE.Vector3().copy(currentModel.position).add(relativeOffset), 0.1);
    camera.lookAt(currentModel.position.x, currentModel.position.y + 1, currentModel.position.z);
}

// Update compass function for the new system
function updateCompass() {
    if (!currentModel || !compassElement) return;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(currentModel.quaternion);
    let compassDirection = '';
    
    const threshold = 0.383;
    
    if (direction.z > threshold) {
        compassDirection = 'S';
    } else if (direction.z < -threshold) {
        compassDirection = 'N';
    }
    
    if (direction.x > threshold) {
        compassDirection += (compassDirection ? 'E' : 'E');
    } else if (direction.x < -threshold) {
        compassDirection += (compassDirection ? 'W' : 'W');
    }
    
    if (!compassDirection) {
        if (direction.z > 0) {
            compassDirection = direction.x > 0 ? 'SE' : 'SW';
        } else {
            compassDirection = direction.x > 0 ? 'NE' : 'NW';
        }
    }
    
    compassElement.textContent = `Direction: ${compassDirection}`;
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
    if (currentModel) {
        const rotationSpeed = 0.002;
        currentModel.rotation.y -= movementX * rotationSpeed;
    }
}

init();
