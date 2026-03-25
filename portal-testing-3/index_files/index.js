// =============================================================================
// DOM REFERENCES
// =============================================================================

const viewport = document.querySelector(".viewport#world-viewport");
const camera = document.querySelector(".camera#world-camera");
const skyboxCamera = document.querySelector(".camera#skybox-camera");
const playerShadow = document.querySelector("#player-shadow");

// =============================================================================
// CONSTANTS
// =============================================================================

const MOUSE_SENSITIVITY = 0.005;
const PLAYER_RADIUS = 50;
const GRAVITY = .25;
const MAX_SLOPE_COS = 0.707; // cos(45°)
const FOV = 130;

// =============================================================================
// STATE
// =============================================================================
//
const oldPosition = { x: 250, y: -700, z: 0 };
const curPosition = { x: 250, y: -700, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };
const hovered = { tile: null, element: null };
const activeKeys = new Set();
let isOnGround = false;
const faces = [];
const warps = [];
const portals = [];
let gameMode = document.body.dataset.gameMode;

const edit = {
	tool: document.body.dataset.editTool,
	preventMouse: false,
	controller: null,
	keys: { Digit1: "add", Digit2: "remove", Digit3: "move", Digit4: "rotate", Digit5: "size", Digit6: "shadow", Digit7: "flip", Digit8: "turn" },
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
	remove() {
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
	shadow: ({ dx, dy }) => {
		let shadow = hovered.tile.style.boxShadow ? hovered.tile.style.boxShadow + "," : "";
		if (dx === 0 && dy === 0) {
			if (shadow) shadow = "";
			else shadow = `inset 0 0 30px black`;
		}
		else {
			if (dx !== 0) shadow += `inset ${dx * -30}px 0 30px -30px black`;
			if (dy !== 0) shadow += `inset 0 ${dy * -30}px 30px -30px black`;
		}
		hovered.tile.style.boxShadow = shadow;
	},
	turn() {
		hovered.tile.style.transform += `translateX(100%) rotateZ(90deg)`;
		mergeTransforms(hovered.tile);
	},
	flip() {
		hovered.tile.style.transform += `translateX(100%) rotateY(180deg)`;
		mergeTransforms(hovered.tile);
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
	const speed = 1500 * deltaTime + (gameMode === "EDIT") * 100;
	let moveX = activeKeys.has("KeyA") - activeKeys.has("KeyD");
	let moveZ = activeKeys.has("KeyS") - activeKeys.has("KeyW");

	const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
	if (length > 0) {
		moveX /= length;
		moveZ /= length;
	}

	let velocity = { x: 0, y: forces.y, z: 0 };
	if (gameMode === "EDIT") {
		let moveY = activeKeys.has("ShiftLeft") - activeKeys.has("Space");
		velocity.y += moveY * speed;
	} else {
		forces.y += GRAVITY * speed;
	}

	Object.assign(oldPosition, curPosition);
	velocity.z += (moveZ * Math.cos(rotation.y) - moveX * Math.sin(rotation.y)) * speed;
	velocity.x -= (moveZ * Math.sin(rotation.y) + moveX * Math.cos(rotation.y)) * speed;

	const totalDist = Math.sqrt(velocity.x**2 + velocity.y**2 + velocity.z**2);
	const steps = Math.ceil(totalDist / (PLAYER_RADIUS * 0.5));

	const stepVel = {
		x: velocity.x / steps,
		y: velocity.y / steps,
		z: velocity.z / steps
	};

	for (let s = 0; s < steps; s++) {
		applyMovementStep(stepVel);
	}

	// for (const face of faces) {
	// 	if (curPosition.x <= face.minX || curPosition.x >= face.maxX || curPosition.y <= face.minY || curPosition.y >= face.maxY || curPosition.z <= face.minZ || curPosition.z >= face.maxZ) continue;
	// 	const correction = checkTriangleCollision(curPosition, face, PLAYER_RADIUS);
	// 	if (!correction) continue;
	//
	// 	curPosition.x += correction.x;
	// 	curPosition.y += correction.y;
	// 	curPosition.z += correction.z;
	// }
}



function isPointInTriangle3D(p, a, b, c) {
	const pa = { x: a.x - p.x, y: a.y - p.y, z: a.z - p.z };
	const pb = { x: b.x - p.x, y: b.y - p.y, z: b.z - p.z };
	const pc = { x: c.x - p.x, y: c.y - p.y, z: c.z - p.z };

	const u = vec.cross(pb, pc);
	const v = vec.cross(pc, pa);
	const w = vec.cross(pa, pb);

	if (vec.dot(u, v) < -0.001) return false;
	if (vec.dot(u, w) < -0.001) return false;
	return true;
}

function applyMovementStep(vel) {
	// Move the player by the velocity step
	curPosition.x += vel.x;
	curPosition.y += vel.y;
	curPosition.z += vel.z;

	if (gameMode === "EDIT") return;

	for (const face of faces) {
		if (curPosition.x <= face.minX || curPosition.x >= face.maxX || curPosition.y <= face.minY || curPosition.y >= face.maxY || curPosition.z <= face.minZ || curPosition.z >= face.maxZ) continue;
		const normal = face.normal;
		const distToPlane = vec.dot(vec.sub(curPosition, face[0]), normal);
		if (Math.abs(distToPlane) > PLAYER_RADIUS) continue;

		const closestOnPlane = {
			x: curPosition.x - normal.x * distToPlane,
			y: curPosition.y - normal.y * distToPlane,
			z: curPosition.z - normal.z * distToPlane,
		};

		let closestPoint;
		const inTriangle = isPointInTriangle3D(closestOnPlane, face[0], face[1], face[2])

		if (inTriangle) {
			closestPoint = closestOnPlane;
		} else {
			const edges = [
				closestPointOnSegment(curPosition, face[0], face[1]),
				closestPointOnSegment(curPosition, face[1], face[2]),
				closestPointOnSegment(curPosition, face[2], face[0]),
			];
			let minFacingDist = Infinity;
			for (const edgePt of edges) {
				const d = (curPosition.x - edgePt.x)**2 + (curPosition.y - edgePt.y)**2 + (curPosition.z - edgePt.z)**2;
				if (d < minFacingDist) { minFacingDist = d; closestPoint = edgePt; }
			}
		}

		const diff = { x: curPosition.x - closestPoint.x, y: curPosition.y - closestPoint.y, z: curPosition.z - closestPoint.z };
		const distance = Math.sqrt(diff.x**2 + diff.y**2 + diff.z**2);

		if (distance < PLAYER_RADIUS && distance > 0) {
			const overlap = PLAYER_RADIUS - distance;
			const resolveDir = { x: diff.x / distance, y: diff.y / distance, z: diff.z / distance };
			//
			// slopeCos > 0.707 means the surface is flatter than 45 degrees
			const slopeCos = vec.dot(resolveDir, { x: 0, y: -1, z: 0 });
			if (slopeCos > MAX_SLOPE_COS) {
				isOnGround = true;
				forces.y = 0;
				const horizontalDistSq = (curPosition.x - closestPoint.x)**2 + (curPosition.z - closestPoint.z)**2;
				const verticalNeeded = Math.sqrt(Math.max(0, PLAYER_RADIUS**2 - horizontalDistSq));
				curPosition.y = closestPoint.y - verticalNeeded;
			} else {
				curPosition.x += resolveDir.x * overlap;
				curPosition.y += resolveDir.y * overlap;
				curPosition.z += resolveDir.z * overlap;
				if (slopeCos < -MAX_SLOPE_COS) {
					forces.y = Math.max(0, forces.y);
				}
			}
		}
	}

	for (const face of warps) {
		if (curPosition.x <= face.minX || curPosition.x >= face.maxX || curPosition.y <= face.minY || curPosition.y >= face.maxY || curPosition.z <= face.minZ || curPosition.z >= face.maxZ) continue;
		const normal = face.normal;
		const distToPlane = vec.dot(vec.sub(curPosition, face[0]), normal);
		if (Math.abs(distToPlane) > PLAYER_RADIUS) continue;

		const closestOnPlane = {
			x: curPosition.x - normal.x * distToPlane,
			y: curPosition.y - normal.y * distToPlane,
			z: curPosition.z - normal.z * distToPlane,
		};

		const inTriangle = isPointInTriangle3D(closestOnPlane, face[0], face[1], face[2])

		if (inTriangle) {
			const start = warps[face.id].center;
			const end = warps[face.destination].center;
			curPosition.x += end.x - start.x;
			curPosition.y += end.y - start.y;
			curPosition.z += end.z - start.z;
			oldPosition.x += end.x - start.x;
			oldPosition.y += end.y - start.y;
			oldPosition.z += end.z - start.z;
		}
	}
}

function closestPointOnSegment(p, v, w) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2 + (v.z - w.z)**2;
  if (l2 === 0) return v;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y) + (p.z - v.z) * (w.z - v.z)) / l2;
  t = Math.max(0, Math.min(1, t));
  return {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
    z: v.z + t * (w.z - v.z)
  };
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
	if (code === "KeyH") {
		gameMode = gameMode === "EDIT" ? "SURVIVAL" : "EDIT";
		document.body.dataset.gameMode = gameMode;
		forces.y = 0;
		parseAllTilesInsideCamera();
	}
	if (code === "Space" && gameMode !== "EDIT" && isOnGround) {
		forces.y = -90;
		isOnGround = false;
	}
}

function handleKeyup({ code }) {
	activeKeys.delete(code);
}

const handleBlur = () => activeKeys.clear();

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const perspective = Math.round(
    Math.pow((w / 2) * w / 2 + (h / 2) * h / 2, 0.5) /
      Math.tan(((FOV / 2) * Math.PI) / 180)
  );

  document.body.style.setProperty("--perspective", perspective + "px");
	portals.forEach(p => {
		p.body.style.setProperty("--perspective", perspective + "px");
	});
}


// =============================================================================
// RENDER LOOP & FPS
// =============================================================================

function renderLoop(alpha) {
	const x = oldPosition.x + (curPosition.x - oldPosition.x) * alpha;
	const y = oldPosition.y + (curPosition.y - oldPosition.y) * alpha;
	const z = oldPosition.z + (curPosition.z - oldPosition.z) * alpha;

	camera.style.transform = `
		rotateX(${rotation.x}rad) 
		rotateY(${rotation.y}rad) 
		rotateZ(${rotation.z}rad) 
		translate3d(${-x}px, ${400 - y}px, ${-z}px)`;

	skyboxCamera.style.transform = `
		rotateX(${rotation.x}rad) 
		rotateY(${rotation.y}rad) 
		rotateZ(${rotation.z}rad)`;

	portals.forEach(p => {
		// p.camera.style.transform = `
		// 	rotateX(${rotation.x}rad) 
		// 	rotateY(${rotation.y}rad) 
		// 	rotateZ(${rotation.z}rad) 
		// 	translate3d(${-Math.max(p.minX, Math.min(x, p.maxX))}px, ${400 - Math.max(p.minY, Math.min(y, p.maxY))}px, ${-Math.max(p.minZ, Math.min(z, p.maxZ))}px)`;
		// p.camera.style.transform = `
		// 	rotateX(${rotation.x}rad) 
		// 	rotateY(${rotation.y}rad) 
		// 	rotateZ(${rotation.z}rad) 
		// 	translate3d(${-p.centerX}px, ${-p.centerY}px, ${-p.centerZ}px)`;
		const m = matrixFromTransform(getComputedStyle(camera).transform);
		const inverse = gluInvertMatrix(multiplyMatrix4(m, p.matrix));
		// const finalM = multiplyMatrix4(p.invMatrix, inverse);
		// console.log("" + inverse);
		// Toimii 0 0 0 0 0 
		p.iframe.style.transform = `matrix3d(${inverse}) translate3d(-50%, -50%, calc(-1 * var(--perspective))) `;
		// p.frame.style.translate = "-50% -50% calc(-1 * var(--perspective))";

		//    translate: -50% -50%;
    // transform: translate3d(0px, -400px, calc(-1 * var(--perspective))) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
		//
		// good: translate3d(250px, 600px, 880px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translate3d(-50%, -50%, calc(-1 * var(--perspective)))
		// good: translate3d(0px, -400px, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translate3d(-50%, -50%, calc(-1 * var(--perspective))) translate3d(250px, 1000px, 880px)
		// console.log(`1 matrix3d(${inverse})`);
		// console.log(`2 matrix3d(${p.invMatrix})`);
		// matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,-400,0,1)
		//
		// 1 matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,250,-1100,0,1)
		// 2 matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,499.99200439453125,1999.97998046875,1759.9759521484375,1)


		p.camera.style.transform = `
			rotateX(${rotation.x}rad) 
			rotateY(${rotation.y}rad) 
			rotateZ(${rotation.z}rad) 
			translate3d(${-x}px, ${400 - y}px, ${-z}px)`;

		p.skybox.style.transform = `
			rotateX(${rotation.x}rad) 
			rotateY(${rotation.y}rad) 
			rotateZ(${rotation.z}rad)`;
		// console.log(`matrix3d(${inverse})`);
		// p.camera.style.transform = `
		// 	rotateX(${rotation.x}rad) 
		// 	rotateY(${rotation.y}rad) 
		// 	rotateZ(${rotation.z}rad) 
		// 	translate3d(${-p.centerX}px, ${-p.centerY}px, ${-p.centerZ}px)`;
	});

  playerShadow.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(90deg) translateX(-50%) translateY(-50%)`;
}




// Source - https://stackoverflow.com/a/1148405
// Posted by shoosh, modified by community. See post 'Timeline' for change history
// Retrieved 2026-03-25, License - CC BY-SA 3.0

function gluInvertMatrix(m) {
    let inv = new Float32Array(16), det;

    inv[0] = m[5]  * m[10] * m[15] - 
             m[5]  * m[11] * m[14] - 
             m[9]  * m[6]  * m[15] + 
             m[9]  * m[7]  * m[14] +
             m[13] * m[6]  * m[11] - 
             m[13] * m[7]  * m[10];

    inv[4] = -m[4]  * m[10] * m[15] + 
              m[4]  * m[11] * m[14] + 
              m[8]  * m[6]  * m[15] - 
              m[8]  * m[7]  * m[14] - 
              m[12] * m[6]  * m[11] + 
              m[12] * m[7]  * m[10];

    inv[8] = m[4]  * m[9] * m[15] - 
             m[4]  * m[11] * m[13] - 
             m[8]  * m[5] * m[15] + 
             m[8]  * m[7] * m[13] + 
             m[12] * m[5] * m[11] - 
             m[12] * m[7] * m[9];

    inv[12] = -m[4]  * m[9] * m[14] + 
               m[4]  * m[10] * m[13] +
               m[8]  * m[5] * m[14] - 
               m[8]  * m[6] * m[13] - 
               m[12] * m[5] * m[10] + 
               m[12] * m[6] * m[9];

    inv[1] = -m[1]  * m[10] * m[15] + 
              m[1]  * m[11] * m[14] + 
              m[9]  * m[2] * m[15] - 
              m[9]  * m[3] * m[14] - 
              m[13] * m[2] * m[11] + 
              m[13] * m[3] * m[10];

    inv[5] = m[0]  * m[10] * m[15] - 
             m[0]  * m[11] * m[14] - 
             m[8]  * m[2] * m[15] + 
             m[8]  * m[3] * m[14] + 
             m[12] * m[2] * m[11] - 
             m[12] * m[3] * m[10];

    inv[9] = -m[0]  * m[9] * m[15] + 
              m[0]  * m[11] * m[13] + 
              m[8]  * m[1] * m[15] - 
              m[8]  * m[3] * m[13] - 
              m[12] * m[1] * m[11] + 
              m[12] * m[3] * m[9];

    inv[13] = m[0]  * m[9] * m[14] - 
              m[0]  * m[10] * m[13] - 
              m[8]  * m[1] * m[14] + 
              m[8]  * m[2] * m[13] + 
              m[12] * m[1] * m[10] - 
              m[12] * m[2] * m[9];

    inv[2] = m[1]  * m[6] * m[15] - 
             m[1]  * m[7] * m[14] - 
             m[5]  * m[2] * m[15] + 
             m[5]  * m[3] * m[14] + 
             m[13] * m[2] * m[7] - 
             m[13] * m[3] * m[6];

    inv[6] = -m[0]  * m[6] * m[15] + 
              m[0]  * m[7] * m[14] + 
              m[4]  * m[2] * m[15] - 
              m[4]  * m[3] * m[14] - 
              m[12] * m[2] * m[7] + 
              m[12] * m[3] * m[6];

    inv[10] = m[0]  * m[5] * m[15] - 
              m[0]  * m[7] * m[13] - 
              m[4]  * m[1] * m[15] + 
              m[4]  * m[3] * m[13] + 
              m[12] * m[1] * m[7] - 
              m[12] * m[3] * m[5];

    inv[14] = -m[0]  * m[5] * m[14] + 
               m[0]  * m[6] * m[13] + 
               m[4]  * m[1] * m[14] - 
               m[4]  * m[2] * m[13] - 
               m[12] * m[1] * m[6] + 
               m[12] * m[2] * m[5];

    inv[3] = -m[1] * m[6] * m[11] + 
              m[1] * m[7] * m[10] + 
              m[5] * m[2] * m[11] - 
              m[5] * m[3] * m[10] - 
              m[9] * m[2] * m[7] + 
              m[9] * m[3] * m[6];

    inv[7] = m[0] * m[6] * m[11] - 
             m[0] * m[7] * m[10] - 
             m[4] * m[2] * m[11] + 
             m[4] * m[3] * m[10] + 
             m[8] * m[2] * m[7] - 
             m[8] * m[3] * m[6];

    inv[11] = -m[0] * m[5] * m[11] + 
               m[0] * m[7] * m[9] + 
               m[4] * m[1] * m[11] - 
               m[4] * m[3] * m[9] - 
               m[8] * m[1] * m[7] + 
               m[8] * m[3] * m[5];

    inv[15] = m[0] * m[5] * m[10] - 
              m[0] * m[6] * m[9] - 
              m[4] * m[1] * m[10] + 
              m[4] * m[2] * m[9] + 
              m[8] * m[1] * m[6] - 
              m[8] * m[2] * m[5];

    det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

    if (det == 0)
        return []

    det = 1.0 / det;

    for (let i = 0; i < 16; i++)
        inv[i] *= det;

    return inv;
}

let physicsLoopRemainder = 0;
const PHYSICS_TICK_RATE = 1 / 20;
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
	warps.length = 0;
	portals.length = 0;
	Array.prototype.forEach.call(camera.children, child => parseElemTiles(child, identyMatrix));
}

function parseElemTiles(elem, matrix) {
	const { width, height, transform } = getComputedStyle(elem);
	const matrix2 = multiplyMatrix4(matrix, matrixFromTransform(transform));

	Array.prototype.forEach.call(elem.children, child => parseElemTiles(child, matrix2));

	if (elem.classList.contains("tile")) addWallVertices(parseInt(width), parseInt(height), matrix2);
	else if (elem.classList.contains("warp")) addWarpVertices(elem, parseInt(width), parseInt(height), matrix2);
	else if (elem.classList.contains("portal")) addPortalVertices(elem, parseInt(width), parseInt(height), matrix2);
}

function addWallVertices(w, h, m) {
	const a = [ transformPoint(0, 0, 0, m), transformPoint(w, 0, 0, m), transformPoint(w, h, 0, m) ];
	const b = [ transformPoint(0, 0, 0, m), transformPoint(w, h, 0, m), transformPoint(0, h, 0, m) ];
	[a, b].forEach(tri => {
		addBoundingBoxes(tri);
		tri.normal = getNormal(tri);
	});
	faces.push(a, b);
}

function addWarpVertices(elem, w, h, m) {
	const a = [ transformPoint(0, 0, 0, m), transformPoint(w, 0, 0, m), transformPoint(w, h, 0, m) ];
	const b = [ transformPoint(0, 0, 0, m), transformPoint(w, h, 0, m), transformPoint(0, h, 0, m) ];
	const points = [a[0], a[1], b[1], b[2]];
	[a, b].forEach(tri => {
		addBoundingBoxes(tri);
		tri.normal = getNormal(tri);
		tri.center = points.reduce((acc, { x, y, z }) => ({ x: acc.x + x, y: acc.y + y, z: acc.z + z }), { x: 0, y: 0, z: 0 });
		tri.id = elem.id;

		for (const key in tri.center) {
			tri.center[key] = tri.center[key] / points.length;
		}

		if (elem.dataset.destination) {
			warps.push(tri);
			tri.destination = elem.dataset.destination;
		}

		warps[tri.id] = tri;
	});
}

function addPortalVertices(elem, w, h, m) {
	const points = [ transformPoint(0, 0, 0, m), transformPoint(w, 0, 0, m), transformPoint(w, h, 0, m), transformPoint(0, h, 0, m) ];
	const portal = {
		minX: points.reduce((acc, v) => Math.min(acc, v.x), Infinity),
		maxX: points.reduce((acc, v) => Math.max(acc, v.x), -Infinity),
		minY: points.reduce((acc, v) => Math.min(acc, v.y), Infinity),
		maxY: points.reduce((acc, v) => Math.max(acc, v.y), -Infinity),
		minZ: points.reduce((acc, v) => Math.min(acc, v.z), Infinity),
		maxZ: points.reduce((acc, v) => Math.max(acc, v.z), -Infinity),
	};

	portal.centerX = (portal.minX + portal.maxX) / 2;
	portal.centerY = (portal.minY + portal.maxY) / 2;
	portal.centerZ = (portal.minZ + portal.maxZ) / 2;

	function loadIframe() {
		const innerDoc = elem.contentDocument || elem.contentWindow.document;
		const camera = innerDoc.querySelector("#world-camera");
		const skybox = innerDoc.querySelector("#skybox-camera");

		if (!camera) return;

		const w = window.innerWidth;
		const h = window.innerHeight;
		const perspective = Math.round(
			Math.pow((w / 2) * w / 2 + (h / 2) * h / 2, 0.5) /
				Math.tan(((FOV / 2) * Math.PI) / 180)
		);

		innerDoc.body.style.setProperty("--perspective", perspective + "px");


		portal.camera = camera;
		portal.body = innerDoc.body;
		portal.skybox = skybox;
		portal.iframe = elem;
		portal.matrix = m;
		portals.push(portal);
	};

	elem.onload = loadIframe;
	if (elem.contentDocument?.readyState === "complete") loadIframe();
	// [a, b].forEach(tri => {
	// 	addBoundingBoxes(tri);
	// 	tri.normal = getNormal(tri);
	// 	tri.center = points.reduce((acc, { x, y, z }) => ({ x: acc.x + x, y: acc.y + y, z: acc.z + z }), { x: 0, y: 0, z: 0 });
	// 	tri.id = elem.id;
	//
	// 	for (const key in tri.center) {
	// 		tri.center[key] = tri.center[key] / points.length;
	// 	}
	//
	// 	if (elem.dataset.destination) {
	// 		warps.push(tri);
	// 		tri.destination = elem.dataset.destination;
	// 	}
	//
	// 	warps[tri.id] = tri;
	// });
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
	if (edit.tool === "shadow") return editActions.shadow({dx, dy});
	if (edit.tool === "turn") return editActions.turn();
	if (edit.tool === "flip") return editActions.flip();

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
	if (gameMode !== "EDIT") return;

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
window.addEventListener("resize", handleResize);

document.querySelector("#edit-handles")?.remove();
document.querySelectorAll(".hovered")?.forEach(elem => elem.classList.remove("hovered"));

parseAllTilesInsideCamera();
handleResize();

window.requestAnimationFrame((previousTime) =>
	window.requestAnimationFrame(currentTime => loop(currentTime, previousTime))
);

function loop(currentTime, previousTime) {
  window.requestAnimationFrame((t) => loop(t, currentTime));
  const deltaTime = (currentTime - previousTime) / 1000;
  const alpha = physicsLoop(deltaTime);
  renderLoop(alpha);
}
