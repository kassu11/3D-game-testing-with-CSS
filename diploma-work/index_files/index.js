// =============================================================================
// DOM REFERENCES
// =============================================================================

const viewport = document.querySelector(".viewport#world-viewport");
const camera = document.querySelector(".camera#world-camera");

// =============================================================================
// CONSTANTS
// =============================================================================

const MOUSE_SENSITIVITY = 0.005;

// =============================================================================
// STATE
// =============================================================================

const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };
const activeKeys = new Set();

let hoveredTile = null;
let hoveredElement = null;

// =============================================================================
// PLAYER MOVEMENT & COLLISION
// =============================================================================

function movePlayer(deltaTime) {
	const speed = 2 * deltaTime;
	let moveX = activeKeys.has("KeyA") - activeKeys.has("KeyD");
	let moveZ = activeKeys.has("KeyS") - activeKeys.has("KeyW");
	let moveY = activeKeys.has("ShiftLeft") - activeKeys.has("Space");

	const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
	if (length > 0) {
		moveX /= length;
		moveZ /= length;
	}

	position.z += (moveZ * Math.cos(rotation.y) - moveX * Math.sin(rotation.y)) * speed;
	position.x -= (moveZ * Math.sin(rotation.y) + moveX * Math.cos(rotation.y)) * speed;
	position.y += moveY * speed;
}

// =============================================================================
// INPUT HANDLERS
// =============================================================================

function handleMouseDown(event) {
	if (!document.pointerLockElement) {
		document.body.requestPointerLock({ unadjustedMovement: true });
	}
}

function handleMouseMove(event) {
	if (document.pointerLockElement) {
		rotation.y += event.movementX * MOUSE_SENSITIVITY;
		rotation.x -= event.movementY * MOUSE_SENSITIVITY;
		rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
	}
}

function handleKeydown({ code, repeat }) {
	if (repeat) return;
	activeKeys.add(code);
}

function handleKeyup({ code }) {
	activeKeys.delete(code);
}


// =============================================================================
// RENDER LOOP & FPS
// =============================================================================

function renderLoop(currentTime, previousTime) {
	window.requestAnimationFrame((time) => renderLoop(time, currentTime));

	const deltaTime = currentTime - previousTime;
	movePlayer(deltaTime);

	camera.style.transform = `
		rotateX(${rotation.x}rad) 
		rotateY(${rotation.y}rad) 
		rotateZ(${rotation.z}rad) 
		translate3d(${-position.x}px, ${-position.y}px, ${-position.z}px)`;

	updateHoveredTiles();
}

// =============================================================================
// HOVER & SELECTION UI
// =============================================================================

function handleHoverChange(target) {
	hoveredElement?.classList.toggle("hovered", hoveredElement === hoveredTile);
	hoveredElement = target;
	hoveredElement?.classList.add("hovered");

	const parentTile = target?.classList.contains("tile") ? target : target?.closest(".tile") || null;
	if (parentTile === hoveredTile) return;

	hoveredTile?.querySelector("#edit-handles")?.remove();
	hoveredTile?.classList.remove("hovered");
	hoveredTile = parentTile;
	hoveredTile?.classList.add("hovered");

	if (!hoveredTile) return;

	const hoverHandles = document.createElement("div");
	hoverHandles.id = "edit-handles";
	hoveredTile.append(hoverHandles);

	for (let i = 0; i < 9; i++) {
		const editorHandle = document.createElement("div");
		editorHandle.classList.add("edit-handle");
		hoverHandles.append(editorHandle);
	}
}

function updateHoveredTiles() {
	const centerX = window.innerWidth / 2;
	const centerY = window.innerHeight / 2;
	const elem = document.elementFromPoint(centerX, centerY);
	const target = elem !== viewport ? elem : null;

	if (target === hoveredElement) return;

	handleHoverChange(target);
}


// =============================================================================
// INIT
// =============================================================================

window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("mousedown", handleMouseDown);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

document.querySelector("#edit-handles")?.remove();
document.querySelectorAll(".hovered")?.forEach(elem => elem.classList.remove("hovered"));

window.requestAnimationFrame((previousTime) =>
	window.requestAnimationFrame((currentTime) => renderLoop(currentTime, previousTime))
);
