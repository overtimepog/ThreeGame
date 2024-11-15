import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let scene, camera, renderer, mixer, sheep;
let animationActions = []; // Array to store all animation actions
let currentAction; // Variable to keep track of current action
const moveSpeed = 0.08; // Speed of the sheep movement
const clock = new THREE.Clock(); // Clock for delta time calculations
let cameraMode = 'back'; // Camera mode to switch between front and back views
const planeSize = 20; // Size of the plane
let compassElement;
const keysPressed = {};
let movementAnimation = 'Walk'; // Default movement animation
let idleAnimation = 'Walk';

/*Animation Controls */
//credit: https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/Sidebar.Animation.js

function addAnimation(object, model_animations) {
    animations[object.uuid] = model_animations;

    if (model_animations.length > 0) {
        animsDiv.style.display = "block";
    } else {
        animsDiv.style.display = "none";
    }
}

function animControl(object) {
    let uuid = object !== null ? object.uuid : '';
    let anims = animations[uuid];

    if (anims !== undefined) {
        mixer = new THREE.AnimationMixer(object);
        let options = {};
        for (let animation of anims) {
            options[animation.name] = animation.name;
            let action = mixer.clipAction(animation);
            actions[animation.name] = action;
            animationActions.push(action);
        }
        setOptions(options);
    }
}

function playAnimation(animationName, options = {}) {
    console.log(`Attempting to play animation: ${animationName}`);
    console.log('Options:', options);

    if (mixer && actions[animationName]) {
        console.log('Mixer and action found');
        
        if (currentAction) {
            console.log('Transitioning from existing animation');
            // Get current animation progress before fading out
            const progress = currentAction.time / currentAction.getClip().duration;
            console.log('Current animation progress:', progress);
            currentAction.fadeOut(0.2);
            
            // Start new animation from same progress point
            let action = actions[animationName];
            if (options.repetitions !== undefined) {
                console.log(`Setting loop repetitions to: ${options.repetitions}`);
                action.setLoop(THREE.LoopRepeat, options.repetitions);
            }
            action.reset().fadeIn(0.2).play();
            action.time = progress * action.getClip().duration;
            currentAction = action;
            console.log('New animation started from progress point');
        } else {
            console.log('Starting fresh animation (no current animation)');
            // If no current animation, start from beginning
            let action = actions[animationName];
            if (options.repetitions !== undefined) {
                console.log(`Setting loop repetitions to: ${options.repetitions}`);
                action.setLoop(THREE.LoopRepeat, options.repetitions);
            }
            action.reset().fadeIn(0.2).play();
            currentAction = action;
            console.log('Animation started from beginning');
        }
    } else {
        console.warn('Could not play animation - mixer or action not found');
    }
}

function playAllAnimation(anims) {
    if (anims !== undefined) {
        anims.forEach(function (clip) {
            mixer.clipAction(clip).reset().play();
        });
    }
}

function stopAnimations() {
    if (mixer !== undefined) {
        mixer.stopAllAction();
    }
}

function setOptions(options) {
    var selected = animationsSelect.value;

    while (animationsSelect.children.length > 0) {
        animationsSelect.removeChild(animationsSelect.firstChild);
    }

    for (var key in options) {
        var option = document.createElement('option');
        option.value = key;
        option.innerHTML = options[key];
        animationsSelect.appendChild(option);
    }

    animationsSelect.value = selected;
}

document.getElementById("play").onclick = function () {
    playAnimation(animationsSelect.value);
};
document.getElementById("stop").onclick = stopAnimations;
document.getElementById("playAll").onclick = function () {
    playAllAnimation(animationActions);
};

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
        sheep = null;
        animationActions = [];
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
            mixer = new THREE.AnimationMixer(sheep);

            if (sheep.animations.length > 0) {
                addAnimation(sheep, sheep.animations);
                animControl(sheep);
            }

            playAnimation(idleAnimation, { repetitions: Infinity });
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

    if (direction.lengthSq() > 0) {
        if (currentAction && currentAction._clip.name !== movementAnimation) {
            playAnimation(movementAnimation, { repetitions: Infinity });
        }
    } else {
        if (currentAction && currentAction._clip.name !== idleAnimation) {
            playAnimation(idleAnimation, { repetitions: Infinity });
        }
    }

    if (direction.lengthSq() > 0) {
        direction.normalize();
        const rotatedDirection = direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), sheep.rotation.y);
        sheep.position.addScaledVector(rotatedDirection, moveSpeed);
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
    if (!sheep || !compassElement) return;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(sheep.quaternion);
    let compassDirection = '';
    
    // Use tighter thresholds and handle diagonals better
    const threshold = 0.383; // cos(67.5°) for 45° segments
    
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
    
    // If no direction was set, sheep must be facing between cardinal directions
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
    if (sheep) {
        const rotationSpeed = 0.002;
        sheep.rotation.y -= movementX * rotationSpeed;
    }
}

init();
