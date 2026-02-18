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

const hovered = { tile: null, element: null };

const edit = {
	tool: null,
	preventMouse: false,
	controller: null,
}

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
		return;
	}

	if (!hovered.element) return;

	toggleHandleEdit();

}

function handleMouseMove(event) {
	if (!document.pointerLockElement) {
		return;
	}

	if (!edit.preventMouse) {
		rotation.y += event.movementX * MOUSE_SENSITIVITY;
		rotation.x -= event.movementY * MOUSE_SENSITIVITY;
		rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
		return;
	}

	// hoveredTile.
}

function handleKeydown({ code, repeat }) {
	if (repeat) return;
	activeKeys.add(code);

	if (code === "Digit1") {
		handleEditToolChange("add");
	} else if (code === "Digit2") {
		handleEditToolChange("remove");
	} else if (code === "Digit3") {
		handleEditToolChange("move");
	} else if (code === "Digit4") {
		handleEditToolChange("rotate");
	}
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
	// if (target.id === "edit-handles") {
	// }
	hovered.element?.classList.toggle("hovered", hovered.element === hovered.tile);
	hovered.element = target;
	hovered.element?.classList.add("hovered");

	const parentTile = target?.classList.contains("tile") ? target : target?.closest(".tile") || null;
	if (parentTile === hovered.tile) return;

	hovered.tile?.querySelector("#edit-handles")?.remove();
	hovered.tile?.classList.remove("hovered");
	hovered.tile = parentTile;
	hovered.tile?.classList.add("hovered");

	if (!hovered.tile) return;

	const hoverHandles = document.createElement("div");
	hoverHandles.id = "edit-handles";
	hovered.tile.append(hoverHandles);

	for (let i = 0; i < 9; i++) {
		const editorHandle = document.createElement("div");
		editorHandle.classList.add("edit-handle");
		hoverHandles.append(editorHandle);
	}
}

const xAxis = [ -1, 0, 1, -1, 0, 1, -1, 0, 1, ];
const yAxis = [ -1, -1, -1, 0, 0, 0, 1, 1, 1 ];
const zAxis = [ 0, 0, 0, 0, 1, 0, 0, 0, 0 ];

function toggleHandleEdit() {
	edit.controller?.abort();
	edit.controller = new AbortController();

	if (edit.preventMouse || hovered.element === hovered.tile) {
		edit.preventMouse = false;
		return;
	}

	const index = Array.prototype.indexOf.call(hovered.element.parentElement.children, hovered.element);
	const width = parseInt(hovered.tile.style.width) || 0;
	const height = parseInt(hovered.tile.style.height) || 0;
	const transform = hovered.tile.style.transform || "";
	let movementRaw = 0;
	let movement = 0;
	console.log(index);

	const dx = xAxis[index];
	const dy = yAxis[index];
	const dz = zAxis[index];

	if (edit.tool === "add") {
		if (!dx && !dy) return;

		const clone = hovered.tile.cloneNode(true);
		clone.classList.remove("hovered");
		clone.querySelector("#edit-handles")?.remove();
		clone.style.transform = transform + `translateX(${dx * 100}%) translateY(${dy * 100}%)`;
		camera.append(clone);
	} else if (edit.tool === "remove") {
		hovered.tile.remove();
	} else {
		edit.preventMouse = true;
		window.addEventListener("keydown", event => {
			if (event.code === "Escape" || (event.ctrlKey && event.code === "KeyZ")) {
				hovered.tile.style.height = height + "px";
				hovered.tile.style.width = width + "px";
				hovered.tile.style.transform = transform;
				edit.controller.abort();
				edit.preventMouse = false;
				event.stopPropagation();
			}
		}, { signal: edit.controller.signal });

		window.addEventListener("mousemove", event => {
			movementRaw -= event.movementX;
			movement = Math.round(movementRaw / 5) * 5;

			if (edit.tool === "move") {
				if (!dx && !dy && !dz) return;
				hovered.tile.style.transform = transform + ` translate3d(${dx * movement}px, ${dy * movement}px, ${dz * movement}px) `;
			}
			else if (edit.tool === "rotate") {
				if (!dx && !dy) return;
				hovered.tile.style.transform = transform +
					` translateX(${Math.max(dx * 100, 0)}%)` +
					` translateY(${Math.max(dy * 100, 0)}%)` +
					` rotateX(${dy * movement}deg)` +
					` rotateY(${dx * movement}deg)` + 
					` translateX(${-Math.max(dx * 100, 0)}%)` +
					` translateY(${-Math.max(dy * 100, 0)}%)`;
			}
		}, { signal: edit.controller.signal });
	}
}

function updateHoveredTiles() {
	const centerX = window.innerWidth / 2;
	const centerY = window.innerHeight / 2;
	const elem = document.elementFromPoint(centerX, centerY);
	const target = elem !== viewport ? elem : null;

	if (target === hovered.element) return;
	if (edit.preventMouse) return;

	handleHoverChange(target);
}

function handleEditToolChange(tool) {
	edit.tool = tool;
	document.body.dataset.editTool = tool;
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
