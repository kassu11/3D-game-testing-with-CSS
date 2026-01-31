const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const yForceElement = document.querySelector("#y-force");
const posElement = document.querySelector("#pos");
const hoverRect = document.querySelector("#hoverRect");
const hoverPolygon = hoverRect.querySelector("polygon");
const hoverCornerTooltips = createHoverToolTips();

const cornerA = document.querySelector("#cornerA") ?? document.createElement("div");
const cornerB = document.querySelector("#cornerB") ?? document.createElement("div");
const cornerC = document.querySelector("#cornerC") ?? document.createElement("div");
const cornerD = document.querySelector("#cornerD") ?? document.createElement("div");

const userKeys = new Set();

let mode = "move";
const sensitivity = 0.005;
const position = { x: 50, y: 500, z: 50 };
const hitbox = { x: 25, y: 100, z: 25 };
const rotation = { x: 0, y: 0, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
let isOnGroup = false;

const planes = [
  [{ x: -500, y: 0, z: -500 }, { x: -500, y: 0, z: 1000 }, { x: 1000, y: 0, z: -500 }]
]

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
 * Tests if a player (sphere) intersects a plane.
 * @param {Object} sphere - { center: {x,y,z}, radius: r }
 * @param {Object} plane - { normal: {x,y,z}, d: distance_from_origin }
 * @returns {boolean} - true if intersecting
 */
function testSpherePlane(sphere, plane) {
  // 1. Compute the signed distance of the sphere center from the plane 
  // Assumes plane.normal is a unit vector (length of 1.0)
  const dist = dot(sphere.center, plane.normal) - plane.d;

  // 2. Intersection occurs if distance is within the radius 
  return Math.abs(dist) <= sphere.radius;
}


// Example Usage:
const player = { center: position, radius: 100 };
const ground = { normal: { x: 0, y: 1, z: 0 }, d: 0 }; // Plane at y=0

const tile = {
  center: { x: 100, y: 50, z: -234 },
  // Rotation: three unit vectors representing the tile's local X, Y, and Z axes
  axes: [
    { x: 1, y: 0, z: 0 }, // Right (width direction)
    { x: 0, y: 1, z: 0 }, // Up (the "normal")
    { x: 0, y: 0, z: 1 }  // Forward (height direction)
  ],
  extents: { x: 500, z: 500 }, // Half-width and half-height
  radius: 0.1 // Thickness of the tile
};

const tiles = [
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
    "width": 100,
    "height": 510,
    "matrix": [0.974514, 0.170152, 0.146186, 0, -0.0951869, -0.276443, 0.956305, 0, 0.203129, -0.945848, -0.253202, 0, 969.585, -167.091, 403.516, 1],
    "desc": "Tile 4"
  }
];



function processTile(tile) {
  tile.quads = [
    transformPoint(0, 0, 0, tile.matrix),
    transformPoint(tile.width, 0, 0, tile.matrix),
    transformPoint(tile.width, tile.height, 0, tile.matrix),
    transformPoint(0, tile.height, 0, tile.matrix),
  ];
}

function transformPoint(x, y, z = 0, matrix) {
  return {
    x: matrix[0]*x + matrix[4]*y + matrix[8]*z  + matrix[12],
    y: matrix[1]*x + matrix[5]*y + matrix[9]*z  + matrix[13],
    z: matrix[2]*x + matrix[6]*y + matrix[10]*z + matrix[14]
  };
}



function testSphereTile(sphere, tile) {
  // 1. Calculate vector from tile center to sphere center
  let d = {
    x: sphere.center.x - tile.center.x,
    y: sphere.center.y - tile.center.y,
    z: sphere.center.z - tile.center.z
  };

  // 2. Project d onto the tile's axes to find local coordinates
  // This handles the rotation of the tile [cite: 118, 132]
  let q = { x: tile.center.x, y: tile.center.y, z: tile.center.z };

  // Check Width (Local X)
  let dist = dot(d, tile.axes[0]);
  if (dist > tile.extents.x) dist = tile.extents.x;
  if (dist < -tile.extents.x) dist = -tile.extents.x;
  q.x += dist * tile.axes[0].x;
  q.y += dist * tile.axes[0].y;
  q.z += dist * tile.axes[0].z;

  // Check Height (Local Z)
  dist = dot(d, tile.axes[2]);
  if (dist > tile.extents.z) dist = tile.extents.z;
  if (dist < -tile.extents.z) dist = -tile.extents.z;
  q.x += dist * tile.axes[2].x;
  q.y += dist * tile.axes[2].y;
  q.z += dist * tile.axes[2].z;

  // q is now the closest point on the tile surface to the sphere 

  // 3. Check if the distance from sphere center to q is within radius
  let v = {
    x: q.x - sphere.center.x,
    y: q.y - sphere.center.y,
    z: q.z - sphere.center.z
  };

  return dot(v, v) <= (sphere.radius * sphere.radius);
}

if (testSpherePlane(player, ground)) {
    console.log("Player is touching the ground!");
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
      forces.y += 11;
    }
  } else if (code === "KeyR") {
    position.x = 0;
    position.y = 0;
    position.z = 0;
    forces.y = 0;
  } else if (code === "KeyP") {
    const arr = Array.from(document.querySelectorAll(".tile.hitbox")).map((tile, i) => {
      console.log(getComputedStyle(tile).transform, tile);
      return {
        width: parseInt(tile.style.width),
        height: parseInt(tile.style.height),
        matrix: getComputedStyle(tile).transform.match(/matrix3d\((.+)\)/)[1].split(",").map(Number),
        desc: `Tile ${i + 1}`,
      };
    });

    console.log(JSON.stringify(arr, (k, v) => {
      if (k === "matrix") {
        return `§[${v.join(", ")}]§`;
      }

      return v;
    }, 2).replace(/"§|§"/g, ""));
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


function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x/len, y: v.y/len, z: v.z/len };
}

const movePlayer = (deltaTime) => {
  const moveSpeed = (600 * deltaTime) / 1000;

  const {x,y,z} = position;

  if (userKeys.has("KeyW")) {
    position.z -= moveSpeed * Math.cos(rotation.y);
    position.x += moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyA")) {
    position.z -= moveSpeed * Math.sin(rotation.y);
    position.x -= moveSpeed * Math.cos(rotation.y);
  }
  if (userKeys.has("KeyS")) {
    position.z += moveSpeed * Math.cos(rotation.y);
    position.x -= moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyD")) {
    position.z += moveSpeed * Math.sin(rotation.y);
    position.x += moveSpeed * Math.cos(rotation.y);
  }

  if (userKeys.has("Space")) position.y += moveSpeed;
  if (userKeys.has("ShiftLeft")) position.y -= moveSpeed;



  if (position.x === x && position.y === y && position.z === z) {
    return
  }

  // TEST
  tiles.forEach(tile => {
    const ray = {
      origin: {x, y, z},
      dir: normalize({x:  x - position.x, y:  y - position.y, z:  z - position.z})    // direction you're moving
    };
    const plane = planeFromQuad(tile.quads[0], tile.quads[1], tile.quads[2]);
    plane.d -= 25; // player radius

    const hit = intersectRayPlane(ray, plane);


    if (hit && pointInQuad(hit, tile.quads)) {
      if (
        hit.y >= position.y &&
          hit.y <= position.y + 200
      ) {
        console.log("Collision at", hit);
      }
    }
  });
  // END TEST
};


function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a, b) {
  return a.x*b.x + a.y*b.y + a.z*b.z;
}

function cross(a, b) {
  return {
    x: a.y*b.z - a.z*b.y,
    y: a.z*b.x - a.x*b.z,
    z: a.x*b.y - a.y*b.x
  };
}


function pointInQuad(p, q) {
  return (
    pointInTriangle(p, q[0], q[1], q[2]) ||
    pointInTriangle(p, q[0], q[2], q[3])
  );
}

function pointInTriangle(p, a, b, c) {
  const v0 = sub(c, a);
  const v1 = sub(b, a);
  const v2 = sub(p, a);

  const dot00 = dot(v0, v0);
  const dot01 = dot(v0, v1);
  const dot02 = dot(v0, v2);
  const dot11 = dot(v1, v1);
  const dot12 = dot(v1, v2);

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return u >= 0 && v >= 0 && u + v <= 1;
}

function intersectRayPlane(ray, plane) {
  const denom = dot(plane.normal, ray.dir);
  if (Math.abs(denom) < 1e-6) return null;

  const t = -(dot(plane.normal, ray.origin) + plane.d) / denom;
  if (t < 0) return null;

  return {
    x: ray.origin.x + ray.dir.x * t,
    y: ray.origin.y + ray.dir.y * t,
    z: ray.origin.z + ray.dir.z * t,
    t
  };
}

function planeFromQuad(a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const normal = normalize(cross(ab, ac));
  return { normal, d: -dot(normal, a) };
}

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

  {
    tiles.forEach(tile => {
      processTile(tile);

      const div = document.createElement("div");
      div.classList.add("tile", "hitbox");
      div.style.transform = `matrix3d(${tile.matrix})`;
      // div.style.background = "repeating-conic-gradient(black 0deg, black 25%, transparent 0deg, transparent 50%) 50% center / 100px 100px, linear-gradient(0deg, grey 0%, grey 100%)";
      div.style.background = "linear-gradient(to right, #333 , gray)";
      div.textContent = tile.desc;
      div.style.width = tile.width + "px";
      div.style.height = tile.height + "px";
      camera.append(div);
    });
  }

  const floor = document.createElement("div");
  floor.classList.add("tile");
  floor.style.pointerEvents = "none";
  floor.style.transform = `translate3d(-500px, 100px, -500px) rotateX(90deg)`;
  floor.style.background = `
repeating-conic-gradient(black 0 25%, transparent 0 50%) 50% / 100px 100px,
linear-gradient(
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
    )
`;
  floor.style.width = "4000px";
  floor.style.height = "4000px";
  camera.append(floor);
}

function get3DPosition(el) {
  const transform = getComputedStyle(el).transform;

  if (transform === "none") {
    return { x: 0, y: 0, z: 0 };
  }

  const values = transform
    .match(/matrix3d\((.+)\)/)[1]
    .split(",")
    .map(Number);

  return {
    scaleX: values[0],
    scaleZ: values[6],
    x: values[12],
    y: values[13],
    z: values[14],
  };
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
  if (editingTileMode) {
    exitMovingMove();
    return;
  }

  if (hoveredTile) {
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

  camera.style.transform = `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;

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
