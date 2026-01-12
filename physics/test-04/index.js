const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const yForceElement = document.querySelector("#y-force");
const posElement = document.querySelector("#pos");
const hoverRect = document.querySelector("#hoverRect");
const hoverPolygon = hoverRect.querySelector("polygon");
const hoverCornerTooltips = createHoverToolTips();

const GRAVITY = 0.02;      // Force applied every frame
const JUMP_FORCE = -12;    // Negative because -Y is Up
const MAX_SLOPE_COS = 0.707; // cos(45 degrees)


const cornerA = document.querySelector("#cornerA") ?? document.createElement("div");
const cornerB = document.querySelector("#cornerB") ?? document.createElement("div");
const cornerC = document.querySelector("#cornerC") ?? document.createElement("div");
const cornerD = document.querySelector("#cornerD") ?? document.createElement("div");

const userKeys = new Set();

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

function getIntersection(p1, p2, a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const normal = cross(ab, ac);

  const rayDir = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const denom = dot(normal, rayDir);

  // If denom is near 0, the movement is parallel to the tile (no collision)
  if (Math.abs(denom) < 1e-6) return null;

  const pa = { x: a.x - p1.x, y: a.y - p1.y, z: a.z - p1.z };
  const t = dot(normal, pa) / denom;

  // If t is between 0 and 1, the player crossed the plane this frame
  if (t >= 0 && t <= 1) {
    return {
      x: p1.x + rayDir.x * t,
      y: p1.y + rayDir.y * t,
      z: p1.z + rayDir.z * t
    };
  }
  return null;
}


/**
 * Detects if point P is inside the 3D quadrilateral defined by corners A, B, C, D.
 * The corners should be provided in counter-clockwise or clockwise order.
 */
function isPlayerIn3DTile(p, quads, thickness = 10.0) {
  const [a, b, c, d] = quads;

  // Fix 1: Check Vertical Distance to the Tile's Plane
  // We use the first three points to define the plane of the tile.
  const dist = getDistanceToPlane(p, a, b, c);

  // If the player is too far above or below the tile, it's not a hit.
  if (dist > thickness) return false;

  // Fix 2: Check Horizontal Boundaries (Point-in-Polygon in 3D)
  // We split the quad into two triangles: ABC and ACD.
  // This handles any convex transformation like shearing or rotation.
  return isPointInTriangle3D(p, a, b, c) || isPointInTriangle3D(p, a, c, d);
}

function getDistanceToPlane(p, a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };

  // Normal vector of the plane [cite: 41, 42]
  const normal = cross(ab, ac);
  const mag = Math.sqrt(normal.x**2 + normal.y**2 + normal.z**2);

  // Avoid division by zero for degenerate tiles
  if (mag < 1e-6) return Infinity; 

  const n = { x: normal.x / mag, y: normal.y / mag, z: normal.z / mag };

  // Distance = |dot(normal, P - A)| [cite: 13, 126]
  const pa = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z };
  return Math.abs(dot(n, pa));
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


const tiles = [
  {
    position: {x: 0, y: 0, z: 0},
    matrix: [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, -500, 100, -500, 1],
    width: 4000,
    height: 4000,
    desc: "Ground",
    background: `repeating-conic-gradient(black 0 25%, transparent 0 50%) 50% / 100px 100px, linear-gradient(
        90deg,
        rgba(255, 0, 0, 1) 0%,
        rgba(255, 154, 0, 1) 10%,
        rgba(208, 222, 33, 1) 20%,
        rgba(79, 220, 74, 1) 30%,
        rgba(63, 218, 216, 1) 40%,
        rgba(47, 201, 226, 1) 50%,
        rgba(28, 127, 238, 1) 60%,
        rgba(95, 21, 242, 1) 70%,
        rgba(186, 12, 248, 1) 80%,
        rgba(251, 7, 217, 1) 90%,
        rgba(255, 0, 0, 1) 100%
    )`
  },
{
    "width": 100,
    "height": 100,
    "matrix": [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 137, -30, 99, 1],
    "desc": "Tile 1"
  },
  {
    "width": 100,
    "height": 100,
    "matrix": [0.945519, -0.325568, 0, 0, 0, 0, 1, 0, -0.325568, -0.945519, 0, 0, 542.448, -51.4432, 99, 1],
    "desc": "Tile 2"
  },
  {
    "width": 100,
    "height": 510,
    "matrix": [0.945519, -0.325568, 0, 0, -0.0951869, -0.276443, 0.956305, 0, -0.311342, -0.904204, -0.292372, 0, 522.701, -108.794, 375.887, 1],
    "desc": "Tile 3"
  },
  {
    "width": 201,
    "height": 944,
    "matrix": [0.974514, 0.170152, 0.146186, 0, -0.0951869, -0.276443, 0.956305, 0, 0.203129, -0.945848, -0.253202, 0, 969.585, -167.091, 403.516, 1],
    "desc": "Tile 4"
  },
  {
    "width": 201,
    "height": 204,
    "matrix": [0.974514, 0.170152, 0.146186, 0, -0.156133, 0.046556, 0.986639, 0, 0.161072, -0.984318, 0.0719353, 0, 879.729, -428.053, 1306.27, 1],
    "desc": "Tile 5"
  },
  {
    "width": 653,
    "height": 204,
    "matrix": [0.653011, -0.744582, 0.138471, 0, -0.156133, 0.046556, 0.986639, 0, -0.74108, -0.665906, -0.0858529, 0, 453.313, 58.1592, 1215.85, 1],
    "desc": "Tile 6"
  },
  {
    "width": 653,
    "height": 204,
    "matrix": [0.653011, -0.744582, 0.138471, 0, 0.613505, 0.627271, 0.479733, 0, -0.444059, -0.228317, 0.86642, 0, 328.158, -69.8042, 1117.98, 1],
    "desc": "Tile 7"
  },
  {
    "width": 653,
    "height": 196,
    "matrix": [0.653011, -0.744582, 0.138471, 0, -0.754347, -0.623197, 0.206364, 0, -0.0673601, -0.239214, -0.968629, 0, 421.462, 67.6566, 1417.12, 1],
    "desc": "Tile 8"
  },
  {
    "width": 201,
    "height": 204,
    "matrix": [0.514403, -0.848904, 0.121459, 0, -0.156133, 0.046556, 0.986639, 0, -0.843215, -0.526494, -0.108594, 0, 1075.61, -393.852, 1335.65, 1],
    "desc": "Tile 9"
  },
  {
    "width": 201,
    "height": 204,
    "matrix": [0.974514, 0.170152, 0.146186, 0, 0.121821, -0.948617, 0.292037, 0, 0.188365, -0.266786, -0.94517, 0, 847.878, -418.556, 1507.54, 1],
    "desc": "Tile 10"
  },
  {
    "width": 201,
    "height": 944,
    "matrix": [0.509333, -0.838921, -0.191814, 0, -0.0951869, -0.276443, 0.956305, 0, -0.855289, -0.46882, -0.220656, 0, 1165.46, -132.89, 432.899, 1],
    "desc": "Tile 11"
  },
  {
    "width": 898,
    "height": 944,
    "matrix": [0.664944, -0.780883, 0.101173, 0, -0.0951869, -0.276443, 0.956305, 0, -0.718793, -0.64552, -0.258149, 0, 372.465, 534.142, 312.663, 1],
    "desc": "Tile 12"
  }
];



function processTile(tile) {
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
    }
    updateHoverCornerTooltips();
  } else {
    userKeys.add(code);
  }
}
function handleKeyup({ code }) {
  userKeys.delete(code);
}


function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x/len, y: v.y/len, z: v.z/len };
}

const PLAYER_RADIUS = 25;

const movePlayer = (deltaTime) => {
  const moveSpeed = (600 * deltaTime) / 1000;
  
  // 1. Apply Gravity to Y Force
  forces.y += GRAVITY * deltaTime;

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

  // Calculate next position based on velocity
  let nextPos = {
    x: position.x + velocity.x,
    y: position.y + velocity.y,
    z: position.z + velocity.z
  };

  const MAX_SLOPE_COS = 0.707; // cos(45 degrees)
  isOnGroup = false;

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


function createTiles() {
  camera.textContent = "";
  tiles.forEach(tile => {
    processTile(tile);

    const div = document.createElement("div");
    div.classList.add("hitbox");
    div.style.transform = `matrix3d(${tile.matrix})`;
    // div.style.background = "repeating-conic-gradient(black 0deg, black 25%, transparent 0deg, transparent 50%) 50% center / 100px 100px, linear-gradient(0deg, grey 0%, grey 100%)";
    div.style.background = tile.background ?? "linear-gradient(to right, #333 , gray)";
    div.textContent = tile.desc;
    div.style.width = tile.width + "px";
    div.style.height = tile.height + "px";
    camera.append(div);
  });
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
  hoveredTile.style.transform = getComputedStyle(hoveredTile).transform;
  clearSelection();
}

const handleEditingAction = () => {
  const index = Array.from(hoveredElement.parentElement.childNodes).indexOf(hoveredElement);
  const width = parseInt(hoveredTile.style.width) || 0;
  const height = parseInt(hoveredTile.style.height) || 0;
  const transform = hoveredTile.style.transform;
  let movement = 0;

  if (mode === "add") {
    const clone = hoveredTile.cloneNode();
    camera.append(clone);
    if (index === 7) {
      clone.style.transform = transform + ` translateY(${height}px)`;
    } else if (index === 5) {
      clone.style.transform = transform + ` translateX(${width}px)`;
    } else if (index === 1) {
      clone.style.transform = transform + ` translateY(${-height}px)`;
    } else if (index === 3) {
      clone.style.transform = transform + ` translateX(${-width}px)`;
    }
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
      }
    }, {signal: editingModeController.signal});

    window.addEventListener("mousemove", e => {
      movement -= e.movementX;

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
      }
    }, {signal: editingModeController.signal});
  }
}

let editingModeController = new AbortController();
function handleClick(e) {
  if (editingTileMode) {
    exitMovingMove();
    return;
  }

  if (hoveredTile) {
    hoveredTile?.classList.toggle("clicked");
    const style = getComputedStyle(hoveredTile);

    console.log(style.transform);
  }

  if (hoveredElement?.classList.contains("corner")) {
    handleEditingAction();
  }

  handleEnterPointerLock(e);
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

    const matrix = getComputedStyle(tile).transform.match(/matrix3d\((.+)\)/)[1].split(",").map(Number);
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
  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  updateHoveredTiles();
  updateHighlightHoveredTile();

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
