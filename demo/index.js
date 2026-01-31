const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const yForceElement = document.querySelector("#y-force");
const posElement = document.querySelector("#pos");
const hoverRect = document.querySelector("#hoverRect");
const hoverPolygon = hoverRect.querySelector("polygon");
const hoverCornerTooltips = createHoverToolTips();

const GRAVITY = 0.02;      // Force applied every frame
const JUMP_FORCE = -9;    // Negative because -Y is Up
const MAX_SLOPE_COS = 0.707; // cos(45 degrees)
const PLAYER_RADIUS = 25;

const cornerA = document.querySelector("#cornerA") ?? document.createElement("div");
const cornerB = document.querySelector("#cornerB") ?? document.createElement("div");
const cornerC = document.querySelector("#cornerC") ?? document.createElement("div");
const cornerD = document.querySelector("#cornerD") ?? document.createElement("div");

const userKeys = new Set();

let gameMode = "EDIT";
let mode = "move";
const sensitivity = 0.005;
const position = { x: 50, y: -500, z: 50 };
const player = { center: position, radius: 100 };
const hitbox = { x: 25, y: 100, z: 25 };
const rotation = { x: 0, y: 0, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
let isOnGroup = false;

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


/**
 * Robust 3D Point-in-Triangle test 
 */
function isPointInTriangle3D(p, a, b, c) {
  // Translate triangle so P is at the origin 
  const pa = { x: a.x - p.x, y: a.y - p.y, z: a.z - p.z };
  const pb = { x: b.x - p.x, y: b.y - p.y, z: b.z - p.z };
  const pc = { x: c.x - p.x, y: c.y - p.y, z: c.z - p.z };

  // Compute normals for triangles formed by P and the edges 
  const u = cross(pb, pc);
  const v = cross(pc, pa);
  const w = cross(pa, pb);

  // If all sub-normals point in the same direction, P is inside the triangle.
  // Note: We use a small epsilon for floating point robustness[cite: 131].
  if (dot(u, v) < -0.001) return false;
  if (dot(u, w) < -0.001) return false;

  return true;
}

// Helper: Cross Product
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

// Helper: Dot Product
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}


const tiles = [];


function addQuadsToTile(tile) {
  tile.quads = [
    transformPoint(0,          0,           0, tile.matrix), // topLeft
    transformPoint(tile.width, 0,           0, tile.matrix), // topRight
    transformPoint(tile.width, tile.height, 0, tile.matrix), // bottomRight
    transformPoint(0,          tile.height, 0, tile.matrix), // bottomLeft
  ];
}

function transformPoint(x, y, z = 0, matrix) {
  return {
    x: matrix[0]*x + matrix[4]*y + matrix[8]*z  + matrix[12],
    y: matrix[1]*x + matrix[5]*y + matrix[9]*z  + matrix[13],
    z: matrix[2]*x + matrix[6]*y + matrix[10]*z + matrix[14]
  };
}

const fpsValues = Array(20).fill(0);
let fpsIndex = 0;

function handleKeydown({ code, repeat }) {
  if (repeat) {
    return;
  }
  if (code === "Space") {
    userKeys.add(code);
    if (isOnGroup) {
      forces.y = JUMP_FORCE; // Trigger the upward force
      isOnGroup = false;     // Immediately leave the ground
    }
  } else if (code === "KeyR") {
    position.x = 0;
    position.y = 0;
    position.z = 0;
    forces.y = 0;
  } else if (code === "KeyP") {
    camera.querySelectorAll(":scope > :not(.tile), .tile > :not(.tile)").forEach(elem => elem.remove());
    console.log(camera.innerHTML);
  } else if (code === "KeyH") {
    gameMode = gameMode === "EDIT" ? "SURVIVAL" : "EDIT";
    clearSelection();
    forces.y = 0;
    tiles.length = 0;
    createTiles();
  } else if (code.startsWith("Digit")) {
    removeHoverHighlist();

    if (code === "Digit1") {
      mode = "move";
    } else if (code === "Digit2") {
      mode = "scale";
    } else if (code === "Digit3") {
      mode = "add";
    } else if (code === "Digit4") {
      mode = "delete";
    } else if (code === "Digit5") {
      mode = "rotate";
    }
    updateHoverCornerTooltips();
  } else {
    userKeys.add(code);
  }
}
function handleKeyup({ code }) {
  userKeys.delete(code);
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

function createTiles() {
  Array.from(camera.children).forEach(elem => elementToTiles(elem, matrixFromTransform("")))
}

function getComputedMatrixFromElem(elem) {
  const { transform } = getComputedStyle(elem);
  return matrixFromTransform(transform);
}

function matrixFromTransform(transform) {
  if (transform.startsWith("matrix3d")) {
    return transform.substring(9).split(",").map(parseFloat);
  } else if (transform.startsWith("matrix(")) {
    const [a, b, c, d, tx, ty] = transform.substring(7).split(",").map(parseFloat);
    return [
      1,  0,  0, 0,
      0,  1,  0, 0,
      0,  0,  1, 0,
      tx, ty, 0, 1,
    ];
  }

  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]
}

function elementToTiles(elem, matrix) {
  const {width, height, transform} = getComputedStyle(elem);
  const matrix2 = multiplyMatrix4(matrix, matrixFromTransform(transform));
  if (elem.classList.contains("tile")) {
    const tile = {
      width: parseInt(width),
      height: parseInt(height),
      matrix: matrix2
    }

    addQuadsToTile(tile);
    tiles.push(tile);
  }

  if (elem.children.length) {
    Array.from(elem.children).forEach(elem => elementToTiles(elem, matrix2));
  }
}

const movePlayer = (deltaTime) => {
  const moveSpeed = (gameMode === "EDIT" ? 3 : 1) * (600 * deltaTime) / 1000;

  if (gameMode !== "EDIT") {
    // 1. Apply Gravity to Y Force
    forces.y += GRAVITY * deltaTime;
  }

  // 2. Calculate Horizontal Velocity (WASD)
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

  // Calculate next position based on velocity
  let nextPos = {
    x: position.x + velocity.x,
    y: position.y + velocity.y,
    z: position.z + velocity.z
  };

  const MAX_SLOPE_COS = 0.707; // cos(45 degrees)
  isOnGroup = false;

  if (gameMode !== "EDIT") {
    for (const tile of tiles) {
      // 1. Calculate Plane Math
      const ab = { x: tile.quads[1].x - tile.quads[0].x, y: tile.quads[1].y - tile.quads[0].y, z: tile.quads[1].z - tile.quads[0].z };
      const ac = { x: tile.quads[2].x - tile.quads[0].x, y: tile.quads[2].y - tile.quads[0].y, z: tile.quads[2].z - tile.quads[0].z };
      const rawNormal = cross(ab, ac);
      const mag = Math.sqrt(rawNormal.x**2 + rawNormal.y**2 + rawNormal.z**2);
      if (mag < 1e-6) continue;
      const normal = { x: rawNormal.x / mag, y: rawNormal.y / mag, z: rawNormal.z / mag };

      // 2. Signed Distance
      const pa = { x: nextPos.x - tile.quads[0].x, y: nextPos.y - tile.quads[0].y, z: nextPos.z - tile.quads[0].z };
      const distToPlane = dot(normal, pa);

      if (Math.abs(distToPlane) < PLAYER_RADIUS) {
        const closestPointOnPlane = {
          x: nextPos.x - normal.x * distToPlane,
          y: nextPos.y - normal.y * distToPlane,
          z: nextPos.z - normal.z * distToPlane
        };

        if (isPointInTriangle3D(closestPointOnPlane, tile.quads[0], tile.quads[1], tile.quads[2]) || 
          isPointInTriangle3D(closestPointOnPlane, tile.quads[0], tile.quads[2], tile.quads[3])) {

          const overlap = PLAYER_RADIUS - Math.abs(distToPlane);
          const pushDir = distToPlane > 0 ? 1 : -1;

          // 3. Determine Slope "Upwardness" 
          // In your CSS setup, Y is negative for 'up'. So we check dot with [0, -1, 0]
          const slopeCos = dot(normal, { x: 0, y: -1, z: 0 });

          if (slopeCos > MAX_SLOPE_COS) {
            // SHALLOW SLOPE: Stick to it
            isOnGroup = true;
            forces.y = 0;

            // Solve: How much Y movement is needed to resolve the overlap?
            // nextPos.y += overlap / cos(theta)
            nextPos.y += (overlap * pushDir) / normal.y;
          } else {
            // STEEP SLOPE OR WALL: Slide down/along it
            nextPos.x += normal.x * overlap * pushDir;
            nextPos.y += normal.y * overlap * pushDir;
            nextPos.z += normal.z * overlap * pushDir;

            // If it's a ceiling (pointing down), stop upward momentum
            if (slopeCos < -MAX_SLOPE_COS) {
              forces.y = Math.max(0, forces.y);
            }
          }
        }
      }
    }
  }

  position.x = nextPos.x;
  position.y = nextPos.y;
  position.z = nextPos.z;
};


let editingTileMode = false;
function handleMouseMove(event) {
  if (!editingTileMode) {
    rotation.y += event.movementX * sensitivity;
    rotation.x -= event.movementY * sensitivity;
    rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
  }
}

function updateFpsCounter(deltaTime) {
  fpsValues[fpsIndex++ % fpsValues.length] = deltaTime;
  const sum = fpsValues.reduce((acc, v) => acc + v);
  fps.textContent = Math.round((1000 * fpsValues.length) / sum);
}

function handleEnterPointerLock(e) {
  if (document.pointerLockElement) {
    return;
  }
  if (e?.target?.closest(".info-wrapper")) {
    return;
  }

  document.body.requestPointerLock({ unadjustedMovement: true });
}


const exitMovingMove = () => {
  editingTileMode = false;
  editingModeController.abort();
  mergeTransforms(hoveredTile);
  clearSelection();
}

const toDeg = rad => rad * (180 / Math.PI);

function mergeTransforms(elem) {
  const { transform } = getComputedStyle(elem);
  // There are complex computation that are too hard for me
  if (elem.style.transform.match(/scale|skew|matrix3d/)) {
    elem.style.transform = transform;
  } else {
    // Merge duplicate translations and rotations
    const matrix = matrixFromTransform(transform);
    const [x, y, z] = matrix.slice(12);
    const radX = Math.atan2(-matrix[9], matrix[10]);
    const radY = Math.asin(matrix[8]);
    const radZ = Math.atan2(-matrix[4], matrix[0]);
    elem.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${toDeg(radX)}deg) rotateY(${toDeg(radY)}deg) rotateZ(${toDeg(radZ)}deg)`;
  }
}

const handleEditingAction = () => {
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
    if (index === 7) {
      clone.style.transform = transform + ` translateY(${height}px)`;
    } else if (index === 5) {
      clone.style.transform = transform + ` translateX(${width}px)`;
    } else if (index === 1) {
      clone.style.transform = transform + ` translateY(${-height}px)`;
    } else if (index === 3) {
      clone.style.transform = transform + ` translateX(${-width}px)`;
    } else {
      clone.remove();
    }

    mergeTransforms(clone);
  } else if (mode === "delete") {
    hoveredTile.remove();
    updateHoveredTiles();
    removeHoverHighlist();
  } else {
    editingTileMode = true;
    editingModeController = new AbortController();

    removeHoverHighlist();

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || (e.ctrlKey && e.code === "KeyZ")) {
        hoveredTile.style.height = height + "px";
        hoveredTile.style.width = width + "px";
        hoveredTile.style.transform = transform;
        exitMovingMove();
        e.stopPropagation();
      }
    }, {signal: editingModeController.signal});

    window.addEventListener("mousemove", e => {
      movementRaw -= e.movementX;
      if (e.ctrlKey) {
        movement = Math.round(movementRaw / 15) * 15;
      } else {
        movement = movementRaw;
      }

      if (mode === "scale") {
        if (index === 1) {
          hoveredTile.style.height = Math.abs(movement - height) + "px";
          if (height - movement < 0) {
            hoveredTile.style.transform = transform + ` translateY(${height}px)`;
          } else {
            hoveredTile.style.transform = transform + ` translateY(${movement}px)`;
          }
        } else if (index === 3) {
          hoveredTile.style.width =  Math.abs(movement - width) + "px";
          if (width - movement < 0) {
            hoveredTile.style.transform = transform + ` translateX(${width}px)`;
          } else {
            hoveredTile.style.transform = transform + ` translateX(${movement}px)`;
          }
        } else if (index === 7) {
          hoveredTile.style.height = Math.abs(height - movement) + "px";
          if (height - movement < 0) {
            hoveredTile.style.transform = transform + ` translateY(${height - movement}px)`;
          }
        } else if (index === 5) {
          hoveredTile.style.width = Math.abs(width - movement) + "px";
          if (width - movement < 0) {
            hoveredTile.style.transform = transform + ` translateX(${width - movement}px)`;
          }
        }
      } else if (mode === "move") {
        if (index === 1) {
          hoveredTile.style.transform = transform + ` translateY(${movement}px)`;
        } else if (index === 3) {
          hoveredTile.style.transform = transform + ` translateX(${movement}px)`;
        } else if (index === 4) {
          hoveredTile.style.transform = transform + ` translateZ(${movement}px)`;
        } else if (index === 7) {
          hoveredTile.style.transform = transform + ` translateY(${-movement}px)`;
        } else if (index === 5) {
          hoveredTile.style.transform = transform + ` translateX(${-movement}px)`;
        }
      } else if (mode === "add") {
        if (index === 1) {
          hoveredTile.style.transform = transform + ` translateY(${movement}px)`;
        } else if (index === 3) {
          hoveredTile.style.transform = transform + ` translateX(${movement}px)`;
        } else if (index === 7) {
          hoveredTile.style.transform = transform + ` translateY(${-movement}px)`;
        } else if (index === 5) {
          hoveredTile.style.transform = transform + ` translateX(${-movement}px)`;
        }
      } else if (mode === "rotate") {
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
    }, {signal: editingModeController.signal});
  }
}

let editingModeController = new AbortController();
function handleClick(e) {
  if (!document.pointerLockElement) {
    handleEnterPointerLock(e);
    return;
  }

  if (editingTileMode) {
    exitMovingMove();
    return;
  }

  // if (hoveredTile) {
  //   console.log(getComputedMatrixFromElem(hoveredTile));
  // }

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
  const FOV = 120;
  const perspective = Math.round(
    Math.pow(((w / 2) * w) / 2 + ((h / 2) * h) / 2, 0.5) /
      Math.tan(((FOV / 2) * Math.PI) / 180),
  );
  viewport.style.setProperty("--perspective", perspective + "px");
}

let hoveredElement = null;
let hoveredTile = null;

function updateHighlightHoveredTile() {
  if (hoveredTile && !editingTileMode && mode === "delete") {
    const {width, height, x, y} = hoveredTile.getBoundingClientRect();
    hoverRect.style.width = width + "px";
    hoverRect.style.height = height + "px";
    hoverRect.style.left = x + "px";
    hoverRect.style.top = y + "px";

    const {x: x2, y: y2} = cornerA.getBoundingClientRect();
    const {x: x3, y: y3} = cornerB.getBoundingClientRect();
    const {x: x4, y: y4} = cornerC.getBoundingClientRect();
    const {x: x5, y: y5} = cornerD.getBoundingClientRect();
    hoverPolygon.setAttribute("points", `${x2 - x},${y2 - y} ${x3 - x},${y3 - y} ${x4 - x},${y4 - y} ${x5 - x},${y5 - y}`);
  }
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

  const newHoverElement = document.elementFromPoint(
    window.innerWidth / 2,
    window.innerHeight / 2,
  );

  if (newHoverElement === viewport) {
    if (hoveredElement) {
      clearSelection();
    }
    // Chrome will sometimes hover the parent and not always the child, so we need to prevent this check
  } else if (hoveredElement !== newHoverElement && hoveredTile !== newHoverElement) {
    hoveredElement?.classList.remove("active");
    hoveredTile?.classList.remove("active");


    const tile = newHoverElement.classList.contains("corner") ? newHoverElement.parentElement.parentElement : newHoverElement;

    newHoverElement?.classList.add("active");
    tile?.classList.add("active");
    hoveredElement = newHoverElement;
    hoveredTile = tile;

    updateHoverCornerTooltips();

    const matrix = getComputedMatrixFromElem(tile);
    const width2 = parseInt(tile.style.width);
    const height2 = parseInt(tile.style.height);

    cornerA.id = "cornerA";
    cornerA.style.backgroundColor = "purple";

    let {x, y, z} = transformPoint(0, 0, 0, matrix);
    cornerA.style.transform = `translate(50%, 50%) translate3d(${x}px, ${y}px, ${z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
    camera.append(cornerA);

    cornerB.id = "cornerB";
    cornerB.style.backgroundColor = "orange";

    ({x, y, z} = transformPoint(width2, 0, 0, matrix));
    cornerB.style.transform = `translate(50%, 50%) translate3d(${x}px, ${y}px, ${z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
    camera.append(cornerB);

    cornerC.id = "cornerC";
    cornerC.style.backgroundColor = "pink";

    ({x, y, z} = transformPoint(width2, height2, 0, matrix));
    cornerC.style.transform = `translate(50%, 50%) translate3d(${x}px, ${y}px, ${z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
    camera.append(cornerC);

    cornerD.id = "cornerD";
    cornerD.style.backgroundColor = "skyblue";

    ({x, y, z} = transformPoint(0, height2, 0, matrix));
    cornerD.style.transform = `translate(50%, 50%) translate3d(${x}px, ${y}px, ${z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
    camera.append(cornerD);
  }
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("resize", handleResize);
window.addEventListener("blur", handlePointerlockchange);
window.addEventListener("mousedown", handleClick);

document.addEventListener("pointerlockchange", handlePointerlockchange);

const renderLoop = (currentTime, previousTime) => {
  window.requestAnimationFrame((time) => renderLoop(time, currentTime));

  camera.style.transform = `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) translate3d(${-position.x}px, ${-position.y}px, ${-position.z}px)`;

  const deltaTime = currentTime - previousTime;
  if (deltaTime > 10) {
    return
  }

  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  if (gameMode === "EDIT") {
    updateHoveredTiles();
    updateHighlightHoveredTile();
  }

  yForceElement.textContent = forces.y;
  posElement.textContent = JSON.stringify(
    Object.fromEntries(
      Object.entries(position).map(([key, val]) => [key, Math.trunc(val)]),
    ),
  );
};

const removeHoverHighlist = () => {
  hoverRect.style.width = 0;
  hoverRect.style.height = 0;
  hoverRect.style.left = 0;
  hoverRect.style.top = 0;
  hoverPolygon.setAttribute("points", "");
}

const clearSelection = () => {
  removeHoverHighlist();

  hoveredElement?.classList.remove("active");
  hoveredElement = null;
  hoveredTile?.classList.remove("active");
  hoveredTile = null;
}

handleResize();
createTiles();

window.requestAnimationFrame((previousTime) =>
  window.requestAnimationFrame((currentTime) =>
    renderLoop(currentTime, previousTime),
  ),
);
