// =============================================================================
// DOM REFERENCES
// =============================================================================

const viewport = document.querySelector("#viewport");
// const viewport2 = document.querySelector("#viewport2");
const camera = document.querySelector("#camera");
const iframe = document.querySelector("iframe");
let camera2;
iframe.onload = function() {
  const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
  const camera = innerDoc.getElementById('camera');
  const viewport = innerDoc.getElementById('viewport');


  const w = window.innerWidth;
  const h = window.innerHeight;
  const perspective = Math.round(
    Math.pow((w / 2) * w / 2 + (h / 2) * h / 2, 0.5) /
      Math.tan(((FOV / 2) * Math.PI) / 180)
  );

  viewport.style.setProperty("--perspective", perspective + "px");


  camera2 = camera;
};
const posElement = document.querySelector("#pos");
const yForceElement = document.querySelector("#y-force");
const fpsElement = document.querySelector("#fps");
const hoverRect = document.querySelector("#hoverRect");
const hoverPolygon = hoverRect.querySelector("polygon");
const hoverCornerTooltips = createHoverToolTips();

const cornerA = document.querySelector("#cornerA") ?? document.createElement("div");
const cornerB = document.querySelector("#cornerB") ?? document.createElement("div");
const cornerC = document.querySelector("#cornerC") ?? document.createElement("div");
const cornerD = document.querySelector("#cornerD") ?? document.createElement("div");

// =============================================================================
// CONSTANTS
// =============================================================================

const GRAVITY = 0.02;
const JUMP_FORCE = -9;
const MAX_SLOPE_COS = 0.707; // cos(45°)
const PLAYER_RADIUS = 25;
const MOUSE_SENSITIVITY = 0.005;
const FPS_SAMPLE_SIZE = 20;
const FOV = 120;
const editModeKeyMaps = {
  Digit1: "move",
  Digit2: "scale",
  Digit3: "add",
  Digit4: "delete",
  Digit5: "rotate",
};

// =============================================================================
// STATE
// =============================================================================

let gameMode = "EDIT";
let mode = "move";
let isOnGround = false;
let editingTileMode = false;
let editingModeController = new AbortController();

const position = { x: 50, y: -500, z: 50 };
const rotation = { x: 0, y: 0, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
const userKeys = new Set();

const tiles = [];
let hoveredElement = null;
let hoveredTile = null;

const fpsValues = Array(FPS_SAMPLE_SIZE).fill(0);
let fpsIndex = 0;

// =============================================================================
// MATH HELPERS (3D Vectors & Geometry)
// =============================================================================

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Robust 3D point-in-triangle test. */
function isPointInTriangle3D(p, a, b, c) {
  const pa = { x: a.x - p.x, y: a.y - p.y, z: a.z - p.z };
  const pb = { x: b.x - p.x, y: b.y - p.y, z: b.z - p.z };
  const pc = { x: c.x - p.x, y: c.y - p.y, z: c.z - p.z };

  const u = cross(pb, pc);
  const v = cross(pc, pa);
  const w = cross(pa, pb);

  if (dot(u, v) < -0.001) return false;
  if (dot(u, w) < -0.001) return false;
  return true;
}

// =============================================================================
// MATRIX & TRANSFORM HELPERS
// =============================================================================

function transformPoint(x, y, z = 0, matrix) {
  return {
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  };
}

function matrixFromTransform(transform) {
  if (transform.startsWith("matrix3d")) {
    return transform.substring(9).split(",").map(parseFloat);
  }
  if (transform.startsWith("matrix(")) {
    const [a, b, c, d, tx, ty] = transform.substring(7).split(",").map(parseFloat);
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, 0, 1,
    ];
  }
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function multiplyMatrix4(a, b) {
  const out = new Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function getComputedMatrixFromElem(elem) {
  return matrixFromTransform(getComputedStyle(elem).transform);
}

const toDeg = (rad) => rad * (180 / Math.PI);

// =============================================================================
// TILE SYSTEM
// =============================================================================

function addQuadsToTile(tile) {
  tile.quads = [
    transformPoint(0, 0, 0, tile.matrix),
    transformPoint(tile.width, 0, 0, tile.matrix),
    transformPoint(tile.width, tile.height, 0, tile.matrix),
    transformPoint(0, tile.height, 0, tile.matrix),
  ];
}

function elementToTiles(elem, matrix) {
  const { width, height, transform } = getComputedStyle(elem);
  const matrix2 = multiplyMatrix4(matrix, matrixFromTransform(transform));

  if (elem.classList.contains("tile")) {
    const tile = {
      width: parseInt(width),
      height: parseInt(height),
      matrix: matrix2,
    };
    addQuadsToTile(tile);
    tiles.push(tile);
  }

  if (elem.children.length) {
    Array.from(elem.children).forEach((child) => elementToTiles(child, matrix2));
  }
}

function createTiles() {
  tiles.length = 0;
  Array.from(camera.children).forEach((elem) =>
    elementToTiles(elem, matrixFromTransform(""))
  );
}

// =============================================================================
// PLAYER MOVEMENT & COLLISION
// =============================================================================

function movePlayer(deltaTime) {
  const moveSpeed = (gameMode === "EDIT" ? 3 : 1) * (600 * deltaTime) / 1000;

  if (gameMode !== "EDIT") {
    forces.y += GRAVITY * deltaTime;
  }

  let velocity = { x: 0, y: forces.y, z: 0 };

  if (userKeys.has("KeyW")) {
    velocity.z -= moveSpeed * Math.cos(rotation.y);
    velocity.x += moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyS")) {
    velocity.z += moveSpeed * Math.cos(rotation.y);
    velocity.x -= moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyA")) {
    velocity.z -= moveSpeed * Math.sin(rotation.y);
    velocity.x -= moveSpeed * Math.cos(rotation.y);
  }
  if (userKeys.has("KeyD")) {
    velocity.z += moveSpeed * Math.sin(rotation.y);
    velocity.x += moveSpeed * Math.cos(rotation.y);
  }

  if (userKeys.has("Space") && gameMode === "EDIT") {
    position.y -= moveSpeed;
  }
  if (userKeys.has("ShiftLeft") && gameMode === "EDIT") {
    position.y += moveSpeed;
  }

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
}

/** Finds the closest point on a line segment (v-w) to point p */
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

function applyMovementStep(vel) {
  // Move the player by the velocity step
  position.x += vel.x;
  position.y += vel.y;
  position.z += vel.z;

  if (gameMode === "EDIT") return;

  for (const tile of tiles) {
    const q = tile.quads;
    const ab = { x: q[1].x - q[0].x, y: q[1].y - q[0].y, z: q[1].z - q[0].z };
    const ac = { x: q[2].x - q[0].x, y: q[2].y - q[0].y, z: q[2].z - q[0].z };
    const rawNormal = cross(ab, ac);
    const mag = Math.sqrt(rawNormal.x ** 2 + rawNormal.y ** 2 + rawNormal.z ** 2);
    if (mag < 1e-6) continue;
    const normal = { x: rawNormal.x / mag, y: rawNormal.y / mag, z: rawNormal.z / mag };

    const pa = { x: position.x - q[0].x, y: position.y - q[0].y, z: position.z - q[0].z };
    const distToPlane = dot(normal, pa);
    if (Math.abs(distToPlane) > PLAYER_RADIUS) continue;

    const closestOnPlane = {
      x: position.x - normal.x * distToPlane,
      y: position.y - normal.y * distToPlane,
      z: position.z - normal.z * distToPlane,
    };

    let closestPoint;
    const inTriangle = isPointInTriangle3D(closestOnPlane, q[0], q[1], q[2]) ||
      isPointInTriangle3D(closestOnPlane, q[0], q[2], q[3]);

    if (inTriangle) {
      closestPoint = closestOnPlane;
    } else {
      const edges = [
        closestPointOnSegment(position, q[0], q[1]),
        closestPointOnSegment(position, q[1], q[2]),
        closestPointOnSegment(position, q[2], q[3]),
        closestPointOnSegment(position, q[3], q[0])
      ];
      let minFacingDist = Infinity;
      for (const edgePt of edges) {
        const d = (position.x - edgePt.x)**2 + (position.y - edgePt.y)**2 + (position.z - edgePt.z)**2;
        if (d < minFacingDist) { minFacingDist = d; closestPoint = edgePt; }
      }
    }

    const diff = { x: position.x - closestPoint.x, y: position.y - closestPoint.y, z: position.z - closestPoint.z };
    const distance = Math.sqrt(diff.x**2 + diff.y**2 + diff.z**2);

    if (distance < PLAYER_RADIUS && distance > 0) {
      const overlap = PLAYER_RADIUS - distance;
      const resolveDir = { x: diff.x / distance, y: diff.y / distance, z: diff.z / distance };

      // slopeCos > 0.707 means the surface is flatter than 45 degrees
      const slopeCos = dot(resolveDir, { x: 0, y: -1, z: 0 });

      if (slopeCos > MAX_SLOPE_COS) {
        isOnGround = true;
        forces.y = 0;

        // Use Pythagorean theorem to find the exact vertical offset needed
        // to maintain the radius without changing X or Z position.
        const horizontalDistSq = (position.x - closestPoint.x)**2 + (position.z - closestPoint.z)**2;
        const verticalNeeded = Math.sqrt(Math.max(0, PLAYER_RADIUS**2 - horizontalDistSq));

        // Snap exactly to the point where the sphere's "belly" touches the slope
        position.y = closestPoint.y - verticalNeeded;

      } else {
        position.x += resolveDir.x * overlap;
        position.y += resolveDir.y * overlap;
        position.z += resolveDir.z * overlap;

        // If hitting a ceiling (slopeCos < -0.707), kill upward momentum
        if (slopeCos < -MAX_SLOPE_COS) {
          forces.y = Math.max(0, forces.y);
        }
      }
    }
  }
}

// =============================================================================
// INPUT HANDLERS
// =============================================================================

function handleKeydown({ code, repeat }) {
  if (repeat) {
    return;
  }

  if (code === "Space") {
    userKeys.add(code);
    if (isOnGround && gameMode !== "EDIT") {
      forces.y = JUMP_FORCE;
      isOnGround = false;
    }
    return;
  }

  if (code === "KeyR") {
    position.x = 0;
    position.y = 0;
    position.z = 0;
    forces.y = 0;
    return;
  }

  if (code === "KeyP") {
    camera.querySelectorAll(":scope > :not(.tile), .tile > :not(.tile)").forEach((e) => e.remove());
    console.log(camera.innerHTML);
    return;
  }

  if (code === "KeyH") {
    gameMode = gameMode === "EDIT" ? "SURVIVAL" : "EDIT";
    clearSelection();
    forces.y = 0;
    createTiles();
    return;
  }

  if (code.startsWith("Digit")) {
    removeHoverHighlight();
    mode = editModeKeyMaps[code] ?? mode;
    updateHoverCornerTooltips();
    return;
  }

  userKeys.add(code);
}

function handleKeyup({ code }) {
  userKeys.delete(code);
}

function handleMouseMove(event) {
  if (!editingTileMode) {
    rotation.y += event.movementX * MOUSE_SENSITIVITY;
    rotation.x -= event.movementY * MOUSE_SENSITIVITY;
    rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
  }
}

function handleEnterPointerLock(e) {
  if (document.pointerLockElement) return;
  if (e?.target?.closest(".info-wrapper")) return;
  document.body.requestPointerLock({ unadjustedMovement: true });
}

function handleClick(e) {
  if (!document.pointerLockElement) {
    handleEnterPointerLock(e);
    return;
  }
  if (editingTileMode) {
    exitEditingMove();
    return;
  }
  if (hoveredElement?.classList.contains("corner")) {
    handleEditingAction();
  }
}

function handlePointerlockchange() {
  if (document.pointerLockElement) {
    document.addEventListener("mousemove", handleMouseMove);
  } else {
    document.removeEventListener("mousemove", handleMouseMove);
    userKeys.clear();
  }
}

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const perspective = Math.round(
    Math.pow((w / 2) * w / 2 + (h / 2) * h / 2, 0.5) /
      Math.tan(((FOV / 2) * Math.PI) / 180)
  );
  viewport.style.setProperty("--perspective", perspective + "px");
}

// =============================================================================
// EDITING (Transform merge, tile edit actions)
// =============================================================================

function mergeTransforms(elem) {
  const { transform } = getComputedStyle(elem);
  if (elem.style.transform?.match(/scale|skew|matrix3d/)) {
    elem.style.transform = transform;
  } else {
    const matrix = matrixFromTransform(transform);
    const [x, y, z] = matrix.slice(12);
    const radX = Math.atan2(-matrix[9], matrix[10]);
    const radY = Math.asin(matrix[8]);
    const radZ = Math.atan2(-matrix[4], matrix[0]);
    elem.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${toDeg(radX)}deg) rotateY(${toDeg(radY)}deg) rotateZ(${toDeg(radZ)}deg)`;
  }
}

function exitEditingMove() {
  editingTileMode = false;
  editingModeController.abort();
  editingModeController = new AbortController();
  if (hoveredTile) mergeTransforms(hoveredTile);
  clearSelection();
}

function handleEditingAction() {
  const index = Array.from(hoveredElement.parentElement.childNodes).indexOf(hoveredElement);
  const width = parseInt(hoveredTile.style.width) || 0;
  const height = parseInt(hoveredTile.style.height) || 0;
  const transform = hoveredTile.style.transform;
  let movementRaw = 0;
  let movement = 0;

  if (mode === "add") {
    const clone = hoveredTile.cloneNode();
    clone.classList.remove("active");
    camera.append(clone);
    const addOffsets = {
      7: ` translateY(${height}px)`,
      5: ` translateX(${width}px)`,
      1: ` translateY(${-height}px)`,
      3: ` translateX(${-width}px)`,
    };
    if (addOffsets[index]) {
      clone.style.transform = transform + addOffsets[index];
    } else {
      clone.remove();
    }
    mergeTransforms(clone);
    return;
  }

  if (mode === "delete") {
    hoveredTile.remove();
    updateHoveredTiles();
    removeHoverHighlight();
    return;
  }

  editingTileMode = true;
  editingModeController = new AbortController();
  removeHoverHighlight();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" || (e.ctrlKey && e.code === "KeyZ")) {
      hoveredTile.style.height = height + "px";
      hoveredTile.style.width = width + "px";
      hoveredTile.style.transform = transform;
      exitEditingMove();
      e.stopPropagation();
    }
  }, { signal: editingModeController.signal });

  window.addEventListener("mousemove", (e) => {
    movementRaw -= e.movementX;
    movement = e.ctrlKey ? Math.round(movementRaw / 15) * 15 : movementRaw;

    if (mode === "scale") {
      applyScaleEdit(index, width, height, transform, movement);
    } else if (mode === "move") {
      applyMoveEdit(index, transform, movement);
    } else if (mode === "add") {
      applyMoveEdit(index, transform, movement);
    } else if (mode === "rotate") {
      applyRotateEdit(index, transform, movement);
    }
  }, { signal: editingModeController.signal });
}

function applyScaleEdit(index, width, height, transform, movement) {
  if (index === 1) {
    hoveredTile.style.height = Math.abs(movement - height) + "px";
    hoveredTile.style.transform = height - movement < 0 ? transform + ` translateY(${height}px)` : transform + ` translateY(${movement}px)`;
  } else if (index === 3) {
    hoveredTile.style.width = Math.abs(movement - width) + "px";
    hoveredTile.style.transform = width - movement < 0 ? transform + ` translateX(${width}px)` : transform + ` translateX(${movement}px)`;
  } else if (index === 7) {
    hoveredTile.style.height = Math.abs(height - movement) + "px";
    hoveredTile.style.transform = height - movement < 0 ? transform + ` translateY(${height - movement}px)` : transform;
  } else if (index === 5) {
    hoveredTile.style.width = Math.abs(width - movement) + "px";
    hoveredTile.style.transform = width - movement < 0 ? transform + ` translateX(${width - movement}px)` : transform;
  }
}

function applyMoveEdit(index, transform, movement) {
  const moveOffsets = {
    1: ` translateY(${movement}px)`,
    3: ` translateX(${movement}px)`,
    4: ` translateZ(${movement}px)`,
    7: ` translateY(${-movement}px)`,
    5: ` translateX(${-movement}px)`,
  };

  if (moveOffsets[index]) {
    hoveredTile.style.transform = transform + moveOffsets[index];
  }
}

function applyRotateEdit(index, transform, movement) {
  if (index === 3) {
    hoveredTile.style.transform = transform + ` rotateY(${movement}deg)`;
  } else if (index === 1) {
    hoveredTile.style.transform = transform + ` rotateX(${-movement}deg)`;
  } else if (index === 5) {
    hoveredTile.style.transform = transform + ` translateX(100%) rotateY(${-movement}deg) translateX(-100%)`;
  } else if (index === 7) {
    hoveredTile.style.transform = transform + ` translateY(100%) rotateX(${movement}deg) translateY(-100%)`;
  }
}

// =============================================================================
// HOVER & SELECTION UI
// =============================================================================

function createHoverToolTips() {
  const parent = document.createElement("div");
  parent.id = "hoverToolTip";
  for (let i = 0; i < 9; i++) {
    const section = document.createElement("div");
    section.classList.add("corner", "hitbox");
    parent.append(section);
  }
  return parent;
}

function removeHoverHighlight() {
  hoverRect.style.width = "0";
  hoverRect.style.height = "0";
  hoverRect.style.left = "0";
  hoverRect.style.top = "0";
  hoverPolygon.setAttribute("points", "");
}

function clearSelection() {
  removeHoverHighlight();
  hoveredElement?.classList.remove("active");
  hoveredElement = null;
  hoveredTile?.classList.remove("active");
  hoveredTile = null;
}

function updateHighlightHoveredTile() {
  if (!hoveredTile || editingTileMode || mode !== "delete") return;

  const { width, height, x, y } = hoveredTile.getBoundingClientRect();
  hoverRect.style.width = width + "px";
  hoverRect.style.height = height + "px";
  hoverRect.style.left = x + "px";
  hoverRect.style.top = y + "px";

  const pts = [cornerA, cornerB, cornerC, cornerD].map((c) => {
    const r = c.getBoundingClientRect();
    return `${r.x - x},${r.y - y}`;
  });
  hoverPolygon.setAttribute("points", pts.join(" "));
}

function updateHoverCornerTooltips() {
  hoverCornerTooltips.classList.remove("scale", "move", "rotate", "add", "delete");
  hoverCornerTooltips.classList.add(mode);
  if (hoveredTile) {
    hoveredTile.append(hoverCornerTooltips);
  }
}

function updateHoveredTiles() {
  if (editingTileMode) {
    return;
  }

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const newHoverElement = document.elementFromPoint(centerX, centerY);

  if (newHoverElement === viewport) {
    if (hoveredElement) clearSelection();
    return;
  }

  if (newHoverElement === hoveredElement || newHoverElement === hoveredTile) return;

  hoveredElement?.classList.remove("active");
  hoveredTile?.classList.remove("active");

  const tile = newHoverElement.classList.contains("corner")
    ? newHoverElement.parentElement.parentElement
    : newHoverElement;

  newHoverElement?.classList.add("active");
  tile?.classList.add("active");
  hoveredElement = newHoverElement;
  hoveredTile = tile;

  updateHoverCornerTooltips();

  const matrix = getComputedMatrixFromElem(tile);
  const w = parseInt(tile.style.width);
  const h = parseInt(tile.style.height);

  const corners = [
    { el: cornerA, id: "cornerA", color: "purple", pt: transformPoint(0, 0, 0, matrix) },
    { el: cornerB, id: "cornerB", color: "orange", pt: transformPoint(w, 0, 0, matrix) },
    { el: cornerC, id: "cornerC", color: "pink", pt: transformPoint(w, h, 0, matrix) },
    { el: cornerD, id: "cornerD", color: "skyblue", pt: transformPoint(0, h, 0, matrix) },
  ];

  for (const { el, id, color, pt: {x, y, z} } of corners) {
    el.id = id;
    el.style.backgroundColor = color;
    el.style.transform = `translate(50%, 50%) translate3d(${x}px, ${y}px, ${z}px) translate(-50%, -50%)`;
    camera.append(el);
  }
}

// =============================================================================
// RENDER LOOP & FPS
// =============================================================================

function updateFpsCounter(deltaTime) {
  fpsValues[fpsIndex++ % fpsValues.length] = deltaTime;
  const sum = fpsValues.reduce((acc, v) => acc + v, 0);
  fpsElement.textContent = Math.round((1000 * fpsValues.length) / sum);
}

function renderLoop(currentTime, previousTime) {
  window.requestAnimationFrame((time) => renderLoop(time, currentTime));

  camera.style.transform =
    `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) ` +
    `translate3d(${-position.x}px, ${-position.y}px, ${-position.z}px)`;
  // rotateX(0rad) rotateY(1.5708rad) rotateZ(0rad) translate3d(-105px, 405px, -705px)

  if (camera2) {
    // camera2.style.transform =
    //   `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) ` +
    //     `translate3d(${-(position.x + (0 - 345 / 2))}px, ${-(position.y + (300 - 315 / 2))}px, ${-position.z}px)`;

    camera2.style.transform =
      `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) ` +
        `translate3d(${-(position.x)}px, ${-(position.y)}px, ${-position.z}px)`;

  }

  const deltaTime = currentTime - previousTime;
  if (deltaTime > 10) {
    return;
  }

  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);

  if (gameMode === "EDIT") {
    updateHoveredTiles();
    updateHighlightHoveredTile();
  }

  yForceElement.textContent = forces.y;
  posElement.textContent = JSON.stringify(
    Object.fromEntries(Object.entries(position).map(([k, v]) => [k, Math.trunc(v)]))
  );
}

// =============================================================================
// INIT
// =============================================================================

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("resize", handleResize);
window.addEventListener("blur", handlePointerlockchange);
window.addEventListener("mousedown", handleClick);
document.addEventListener("pointerlockchange", handlePointerlockchange);

handleResize();
createTiles();

window.requestAnimationFrame((previousTime) =>
  window.requestAnimationFrame((currentTime) => renderLoop(currentTime, previousTime))
);
