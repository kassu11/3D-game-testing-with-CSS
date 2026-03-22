// =============================================================================
// DOM REFERENCES
// =============================================================================

const viewport = document.querySelector(".viewport#world-viewport");
const camera = document.querySelector(".camera#world-camera");

// =============================================================================
// CONSTANTS
// =============================================================================

const MOUSE_SENSITIVITY = 0.005;
const PLAYER_RADIUS = 50;

// =============================================================================
// STATE
// =============================================================================

const oldPosition = { x: 0, y: 0, z: 0 };
const curPosition = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };
const hovered = { tile: null, element: null };
const activeKeys = new Set();
const faces = [];

const edit = {
	tool: document.body.dataset.editTool,
	preventMouse: false,
	controller: null,
	keys: { Digit1: "add", Digit2: "remove", Digit3: "move", Digit4: "rotate", Digit5: "size" },
}

const vec = {
	sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
	dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
	cross: (a, b) => ({
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x
	}),
	normalize: (a) => {
		const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
		return mag === 0 ? a : { x: a.x / mag, y: a.y / mag, z: a.z / mag };
	},
};

function getNormal(tri) {
	const edge1 = vec.sub(tri[1], tri[0]);
	const edge2 = vec.sub(tri[2], tri[0]);
	return vec.normalize(vec.cross(edge1, edge2));
}

function multiplyMatrix4(a, b) {
	const c = new Float32Array(16);
	for (let j = 0; j < 4; j++) {
		for (let i = 0; i < 4; i++) {
			let sum = 0;
			for (let k = 0; k < 4; k++) sum += a[k * 4 + j] * b[i * 4 + k];
			c[i * 4 + j] = sum;
		}
	}
	return c;
}

function checkTriangleCollision(p, tri, radius) {
	const normal = getNormal(tri);
	const dist = vec.dot(vec.sub(p, tri[0]), normal);

	if (Math.abs(dist) > radius) return null;

	const overlap = radius - Math.abs(dist);

	return {
		x: normal.x * overlap * (dist > 0 ? 1 : -1),
		y: normal.y * overlap * (dist > 0 ? 1 : -1),
		z: normal.z * overlap * (dist > 0 ? 1 : -1),
	};
}

const editActions = {
	remove: () => {
		if (hovered.tile.previousSibling.wholeText) hovered.tile.previousSibling.remove();
		hovered.tile.remove();
	},
	move: ({ dx, dy, dz, transform, delta }) => hovered.tile.style.transform = transform +
		` translate3d(${dx * delta}px, ${dy * delta}px, ${dz * delta}px)`,
	rotate: ({ dx, dy, transform, delta }) => {
		hovered.tile.style.transform = transform +
			` translateX(${Math.max(dx * 100, 0)}%) translateY(${Math.max(dy * 100, 0)}%)` +
			` rotateX(${dy * delta}deg) rotateY(${dx * delta}deg)` +
			` translateX(${-Math.max(dx * 100, 0)}%) translateY(${-Math.max(dy * 100, 0)}%)`;
	},
	add: ({dx, dy}) => {
		if (dx === 0 && dy === 0) return;
		const clone = hovered.tile.cloneNode(true);
		clone.classList.remove("hovered");
		clone.querySelector("#edit-handles")?.remove();
		clone.style.transform += `translateX(${dx * 100}%) translateY(${dy * 100}%)`;
		hovered.tile.after(hovered.tile.previousSibling.wholeText || "", clone);
		mergeTransforms(clone);
	},
	size: ({ dx, dy, transform, delta, width, height}) => {
		if (dy === -1) {
			hovered.tile.style.height = Math.abs(delta - height) + "px";
			transform += height - delta < 0 ? ` translateY(${height}px)` : ` translateY(${delta}px)`;
		} else if (dy === 1) {
			hovered.tile.style.height = Math.abs(height - delta) + "px";
			if (height - delta < 0) transform += ` translateY(${height - delta}px)`;
		}
		if (dx === -1) {
			hovered.tile.style.width = Math.abs(delta - width) + "px";
			transform += width - delta < 0 ? ` translateX(${width}px)` : ` translateX(${delta}px)`;
		} else if (dx === 1) {
			hovered.tile.style.width = Math.abs(width - delta) + "px";
			if (width - delta < 0) transform += ` translateX(${width - delta}px)`;
		}
		hovered.tile.style.transform = transform;
	},
}

const editHandleDirections = [
	{ dx: -1, dy: -1, dz: 0 }, { dx: 0, dy: -1, dz: 0 }, { dx: 1, dy: -1, dz: 0 },
	{ dx: -1, dy: 0,  dz: 0 }, { dx: 0, dy: 0,  dz: 1 }, { dx: 1, dy: 0,  dz: 0 },
	{ dx: -1, dy: 1,  dz: 0 }, { dx: 0, dy: 1,  dz: 0 }, { dx: 1, dy: 1,  dz: 0 },
];

// =============================================================================
// PLAYER MOVEMENT & COLLISION
// =============================================================================

function movePlayer(deltaTime) {
	const speed = 2000 * deltaTime;
	let moveX = activeKeys.has("KeyA") - activeKeys.has("KeyD");
	let moveZ = activeKeys.has("KeyS") - activeKeys.has("KeyW");
	let moveY = activeKeys.has("ShiftLeft") - activeKeys.has("Space");

	const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
	if (length > 0) {
		moveX /= length;
		moveZ /= length;
	}

	Object.assign(oldPosition, curPosition);
	curPosition.z += (moveZ * Math.cos(rotation.y) - moveX * Math.sin(rotation.y)) * speed;
	curPosition.x -= (moveZ * Math.sin(rotation.y) + moveX * Math.cos(rotation.y)) * speed;
	curPosition.y += moveY * speed;

	for (const face of faces) {
		if (curPosition.x <= face.minX || curPosition.x >= face.maxX || curPosition.y <= face.minY || curPosition.y >= face.maxY || curPosition.z <= face.minZ || curPosition.z >= face.maxZ) continue;
		const correction = checkTriangleCollision(curPosition, face, PLAYER_RADIUS);
		if (!correction) continue;

		curPosition.x += correction.x;
		curPosition.y += correction.y;
		curPosition.z += correction.z;
	}
}

// =============================================================================
// INPUT HANDLERS
// =============================================================================

function handleMouseDown() {
	if (!document.pointerLockElement) {
		document.body.requestPointerLock({ unadjustedMovement: true });
		return;
	}

	if (!hovered.element) return;

	handleEdit();

}

function handleMouseMove(event) {
	if (!document.pointerLockElement) return;
	if (edit.preventMouse) return;
	rotation.y += event.movementX * MOUSE_SENSITIVITY;
	rotation.x -= event.movementY * MOUSE_SENSITIVITY;
	rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
}

function handleKeydown({ code, repeat }) {
	if (repeat) return;
	activeKeys.add(code);

	if (code in edit.keys) handleEditToolChange(edit.keys[code]);
	if (code === "KeyR") {
		Object.assign(curPosition, Object.assign(rotation, {x: 0, y: 0, z: 0}));
	}
}

function handleKeyup({ code }) {
	activeKeys.delete(code);
}

const handleBlur = () => activeKeys.clear();


// =============================================================================
// RENDER LOOP & FPS
// =============================================================================

function renderLoop(alpha) {
	camera.style.transform = `
		rotateX(${rotation.x}rad) 
		rotateY(${rotation.y}rad) 
		rotateZ(${rotation.z}rad) 
		translate3d(${-oldPosition.x - (curPosition.x - oldPosition.x) * alpha}px, ${-oldPosition.y - (curPosition.y - oldPosition.y) * alpha}px, ${-oldPosition.z - (curPosition.z - oldPosition.z) * alpha}px)`;
}

let physicsLoopRemainder = 0;
const PHYSICS_TICK_RATE = 1 / 60;
function physicsLoop(deltaTime) {
	// Make sure deltaTime can't cause too many calculations
	if (deltaTime > .25) deltaTime = .25;

	physicsLoopRemainder += deltaTime;

	while (physicsLoopRemainder >= PHYSICS_TICK_RATE) {
		movePlayer(PHYSICS_TICK_RATE);
		physicsLoopRemainder -= PHYSICS_TICK_RATE;
	}

	updateHoveredTiles();

	return physicsLoopRemainder / PHYSICS_TICK_RATE;
}

// =============================================================================
// HOVER & SELECTION UI
// =============================================================================

function handleHoverChange(target) {
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

const toDeg = (rad) => rad * (180 / Math.PI);

function matrixFromTransform(transform) {
	if (transform.startsWith("matrix3d")) return transform.substring(9).split(",").map(parseFloat);
	if (transform.startsWith("matrix(")) {
		const [a, b, c, d, tx, ty] = transform.substring(7).split(",").map(parseFloat);
		return [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, 0, 1 ];
	}

	return [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ];
}

function mergeTransforms(elem) {
	const { transform } = window.getComputedStyle(elem);
	if (elem.style.transform?.match(/scale|skew|matrix3d/)) {
		elem.style.transform = transform;
	} else {
		const m = matrixFromTransform(transform);
		const [x, y, z] = m.slice(12);

		let radX, radY, radZ;

		const sinY = Math.max(-1, Math.min(1, m[8]));
		radY = Math.asin(sinY);

		if (Math.abs(sinY) < 0.99999) {
			radX = Math.atan2(-m[9], m[10]);
			radZ = Math.atan2(-m[4], m[0]);
		} else {
			radX = Math.atan2(m[1], m[5]) * (sinY > 0 ? 1 : -1);
			radZ = 0;
		}

		elem.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${toDeg(radX)}deg) rotateY(${toDeg(radY)}deg) rotateZ(${toDeg(radZ)}deg)`;
	}
}

function parseAllTilesInsideCamera() {
	const identyMatrix = matrixFromTransform("");
	faces.length = 0;
	Array.prototype.forEach.call(camera.children, child => parseElemTiles(child, identyMatrix));
}

function parseElemTiles(elem, matrix) {
	const { width, height, transform } = getComputedStyle(elem);
	const matrix2 = multiplyMatrix4(matrix, matrixFromTransform(transform));

	Array.prototype.forEach.call(elem.children, child => parseElemTiles(child, matrix2));

	if (!elem.classList.contains("tile")) return;
	addVertices(parseInt(width), parseInt(height), matrix2);
}

function addVertices(w, h, m) {
	const a = [ transformPoint(0, 0, 0, m), transformPoint(w, 0, 0, m), transformPoint(w, h, 0, m) ];
	const b = [ transformPoint(0, 0, 0, m), transformPoint(w, h, 0, m), transformPoint(0, h, 0, m) ];
	addBoundingBoxes(a);
	addBoundingBoxes(b);
	faces.push(a, b);
}

function addBoundingBoxes(vertices) {
	vertices.forEach(v => {
		vertices.minX = Math.min(v.x - PLAYER_RADIUS, vertices.minX ?? v.x);
		vertices.maxX = Math.max(v.x + PLAYER_RADIUS, vertices.maxX ?? v.x);
		vertices.minY = Math.min(v.y - PLAYER_RADIUS, vertices.minY ?? v.y);
		vertices.maxY = Math.max(v.y + PLAYER_RADIUS, vertices.maxY ?? v.y);
		vertices.minZ = Math.min(v.z - PLAYER_RADIUS, vertices.minZ ?? v.z);
		vertices.maxZ = Math.max(v.z + PLAYER_RADIUS, vertices.maxZ ?? v.z);
	});
}

function transformPoint(x, y, z, matrix) {
	return {
		x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
		y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
		z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
	};
}

function exitEdit() {
	edit.controller?.abort();
	edit.preventMouse = false;
	if (hovered.tile) mergeTransforms(hovered.tile);
}

function handleEdit() {
	edit.controller?.abort();
	const { signal } = edit.controller = new AbortController();

	if (!edit.tool || edit.preventMouse || !hovered.element?.classList.contains("edit-handle")) return exitEdit();

	mergeTransforms(hovered.tile);

	const index = Array.prototype.indexOf.call(hovered.element.parentElement.children, hovered.element);
	const { dx, dy, dz } = editHandleDirections[index];

	if (edit.tool === "add") return editActions.add({dx, dy});
	if (edit.tool === "remove") return editActions.remove();

	const width = parseInt(hovered.tile.style.width) || 0;
	const height = parseInt(hovered.tile.style.height) || 0;
	const { transform } = hovered.tile.style;
	let movementRaw = 0;

	edit.preventMouse = true;

	window.addEventListener("keydown", event => {
		if (!event.ctrlKey || event.code !== "KeyZ") return;
		exitEdit();
		hovered.tile.style.transform = transform;
		hovered.tile.style.height = height + "px";
		hovered.tile.style.width = width + "px";
	}, { signal });

	window.addEventListener("mousemove", event => {
		movementRaw -= event.movementX;
		const delta = Math.round(movementRaw / 5) * 5;

		if (edit.tool === "move") editActions.move({ dx, dy, dz, delta, transform });
		else if (edit.tool === "size" && index !== 4) editActions.size({ dx, dy, delta, transform, width, height });
		else if (edit.tool === "rotate" && index % 2 === 1) editActions.rotate({ dx, dy, delta, transform });
		else exitEdit();
	}, { signal });
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
	if (tool === edit.tool) {
		edit.tool = null;
		delete document.body.dataset.editTool;
	} else {
		edit.tool = tool;
		document.body.dataset.editTool = tool;
	}
}


// =============================================================================
// INIT
// =============================================================================

window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("mousedown", handleMouseDown);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

window.addEventListener("blur", handleBlur);

document.querySelector("#edit-handles")?.remove();
document.querySelectorAll(".hovered")?.forEach(elem => elem.classList.remove("hovered"));

parseAllTilesInsideCamera();

window.requestAnimationFrame((previousTime) =>
	window.requestAnimationFrame(currentTime => loop(currentTime, previousTime))
);

function loop(currentTime, previousTime) {
  window.requestAnimationFrame((t) => loop(t, currentTime));
  const deltaTime = (currentTime - previousTime) / 1000;
  const alpha = physicsLoop(deltaTime);
  renderLoop(alpha);
}
