const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const yForceElement = document.querySelector("#y-force");
const posElement = document.querySelector("#pos");

const userKeys = new Set();

const sensitivity = 0.005;
const position = { x: 50, y: 500, z: 50 };
const hitbox = { x: 25, y: 100, z: 25 };
const rotation = { x: 0, y: 0, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
let isOnGroup = false;

const planes = [
  [{ x: -500, y: 0, z: -500 }, { x: -500, y: 0, z: 1000 }, { x: 1000, y: 0, z: -500 }]
]

// for (const plane of planes) {
//   for (const points of plane) {
//     const width = 
//   }
// }

// Basic Vector3 math helpers
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

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

function addAxis(tile) {

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
  } else {
    userKeys.add(code);
  }
}
function handleKeyup({ code }) {
  userKeys.delete(code);
}

const movePlayer = (deltaTime) => {
  const moveSpeed = (600 * deltaTime) / 1000;
  // const gravity = (50 * deltaTime) / 1000;

  // isOnGroup = false;
  // if (position.y <= 0) {
  //   isOnGroup = true;
  //   position.y = 0;
  // }
  //
  // if (!isOnGroup) {
  //   forces.y = Math.max(forces.y - gravity, -100);
  // } else {
  //   forces.y = Math.max(forces.y, 0);
  // }

  // position.y += forces.y;
  if (testSphereTile(player, tile)) {
    console.log("Player is touching the tile!");
  }

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
};

function handleMouseMove(event) {
  rotation.y += event.movementX * sensitivity;
  rotation.x -= event.movementY * sensitivity;
  rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
}


function applyTileToCSS(element, tile) {
  const { center, axes, extents } = tile;

  // 1. Dimensions (2 * half-extents)
  element.style.width = `${extents.x * 2}px`;
  element.style.height = `${extents.z * 2}px`;

  // 2. Build the 4x4 Matrix for matrix3d
  // Columns are: Right(u0), Up(u1), Forward(u2), Translation(C)
  const m = [
    axes[0].x, axes[0].y, axes[0].z, 0, // Column 1 (X basis)
    axes[1].x, axes[1].y, axes[1].z, 0, // Column 2 (Y basis)
    axes[2].x, axes[2].y, axes[2].z, 0, // Column 3 (Z basis)
    center.x,  center.y,  center.z,  1  // Column 4 (Position)
  ];

  // 3. Apply the transform
  // Note: Use translate(-50%, -50%) to center the element on its coordinate
  element.style.transform = `translate3d(${center.x}px, -${center.y}px, ${center.z}px) translate(-50%, -50%) rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) `;
}

function createTiles() {
  camera.textContent = "";

  // {
  //   const div = document.createElement("div");
  //   applyTileToCSS(div, tile);
  //   // div.style.width = tile.axes[0].x + "px";
  //   // div.style.height = tile.axes[2].z + "px";
  //   div.style.background = "red";
  //
  //   camera.append(div);
  // }
  {
    const div = document.createElement("div");
    div.style.width = "1000px";
    div.style.height = "1000px";

    // div.style.transform = `translate(50%, 50%) translate3d(${-200}px, -${1100}px, ${-200}px)  rotateX(${5}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%)`;
    div.style.transform = `translate(50%, 50%) translate3d(${-200}px, -${1100}px, ${-200}px)  rotateX(${.2}rad) rotateY(${.3}rad) scale(0.5) rotateZ(${.1}rad) translate(-50%, -50%)`;
    div.style.background = "red";

    camera.append(div);
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

  basic: {
    const hitbox = document.createElement("div");
    hitbox.classList.add("tile", "hitbox");
    hitbox.style.transform = `translate3d(0px, 50px, 0px) rotateX(90deg)`;
    hitbox.style.background = `
repeating-conic-gradient(black 0 25%, grey 0 50%) 50% / 100px 100px
`;
    hitbox.style.width = "200px";
    hitbox.style.height = "200px";
    hitbox.textContent = "Plane 200 x 200";
    camera.append(hitbox);
  }
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

// par: matrix3d(0.836516, 0.519543  , 0.174117, 0, -0.482964, 0.549004 , 0.682158, 0, 0.25882   , -0.654728, 0.710171 , 0, 1400   , -550    , -234    , 1);
// chi: matrix3d(0.816811, -0.224749 , 0.531327, 0, -0.11719 , 0.837153 , 0.534268, 0, -0.564878 , -0.498661, 0.657457 , 0, -1800  , -550    , -234    , 1);
// res: matrix3d(0.929339, -0.0468943, 0.366239, 0, -0.364067, 0.0489149, 0.930087, 0, -0.0615312, -0.997701, 0.0283864, 0, 99.3375, -1633.92, -1088.78, 1);



// {
//   function multiplyMatrix4(a, b) {
//     const out = new Array(16);
//
//     for (let row = 0; row < 4; row++) {
//       for (let col = 0; col < 4; col++) {
//         out[col * 4 + row] =
//           a[0 * 4 + row] * b[col * 4 + 0] +
//             a[1 * 4 + row] * b[col * 4 + 1] +
//             a[2 * 4 + row] * b[col * 4 + 2] +
//             a[3 * 4 + row] * b[col * 4 + 3];
//       }
//     }
//
//     return out;
//   }
//
//
//
//   const A = [
//     0.836516, 0.519543,  0.174117, 0,
//     -0.482964, 0.549004,  0.682158, 0,
//     0.25882, -0.654728,  0.710171, 0,
//     1400,    -550,      -234,      1
//   ];
//
//   const B = [
//     0.816811, -0.224749, 0.531327, 0,
//     -0.11719,   0.837153, 0.534268, 0,
//     -0.564878, -0.498661, 0.657457, 0,
//     -1800,     -550,     -234,      1
//   ];
//
//   const combined = multiplyMatrix4(A, B);
//
//   console.log(combined);
//   console.log([ 0.929339, -0.0468943, 0.366239, 0, -0.364067, 0.0489149, 0.930087, 0, -0.0615312, -0.997701, 0.0283864, 0, 99.3375, -1633.92, -1088.78, 1 ]);
// }




// center x y z
// width: 50
// height: 100
// rotation x y z





function handleClick(e) {
  const activeElement = document.elementFromPoint(
    window.innerWidth / 2,
    window.innerHeight / 2,
  );
  if (activeElement !== viewport) {
    activeElement?.classList.toggle("clicked");
    if (activeElement) {
      const style = getComputedStyle(activeElement);
      // Matrix3d
      //
      // matrix3d(a1, b1, c1, d1,
      //          a2, b2, c2, d2,
      //          a3, b3, c3, d3,
      //          a4, b4, c4, d4) // Position x y z 1???

      console.log(style.transform);

      const values = style.transform
      .match(/matrix3d\((.+)\)/)[1]
      .split(",")
      .map(Number);


      const width = 1000;
      const height = 1000;

      // Multiply a 3D point by a CSS matrix3d
      function transformPoint(x, y, z = 0) {
        return {
          x: values[0]*x + values[4]*y + values[8]*z  + values[12],
          y: values[1]*x + values[5]*y + values[9]*z  + values[13],
          z: values[2]*x + values[6]*y + values[10]*z + values[14]
        };
      }

      // Local-space corners of the element
      const corners = {
        topLeft:     transformPoint(0, 0),
        topRight:    transformPoint(width, 0),
        bottomRight: transformPoint(width, height),
        bottomLeft:  transformPoint(0, height)
      };

      const cornerA = document.querySelector("#cornerA") ?? document.createElement("div");
      cornerA.id = "cornerA";
      cornerA.style.backgroundColor = "purple";
      cornerA.style.width = "10px";
      cornerA.style.height = "10px";

      cornerA.style.transform = `translate(50%, 50%) translate3d(${corners.topLeft.x}px, ${corners.topLeft.y}px, ${corners.topLeft.z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
      camera.append(cornerA);

      const cornerB = document.querySelector("#cornerB") ?? document.createElement("div");
      cornerB.id = "cornerB";
      cornerB.style.backgroundColor = "orange";
      cornerB.style.width = "10px";
      cornerB.style.height = "10px";

      cornerB.style.transform = `translate(50%, 50%) translate3d(${corners.topRight.x}px, ${corners.topRight.y}px, ${corners.topRight.z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
      camera.append(cornerB);

      const cornerC = document.querySelector("#cornerC") ?? document.createElement("div");
      cornerC.id = "cornerC";
      cornerC.style.backgroundColor = "pink";
      cornerC.style.width = "10px";
      cornerC.style.height = "10px";

      cornerC.style.transform = `translate(50%, 50%) translate3d(${corners.bottomLeft.x}px, ${corners.bottomLeft.y}px, ${corners.bottomLeft.z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
      camera.append(cornerC);

      const cornerD = document.querySelector("#cornerD") ?? document.createElement("div");
      cornerD.id = "cornerD";
      cornerD.style.backgroundColor = "skyblue";
      cornerD.style.width = "10px";
      cornerD.style.height = "10px";

      cornerD.style.transform = `translate(50%, 50%) translate3d(${corners.bottomRight.x}px, ${corners.bottomRight.y}px, ${corners.bottomRight.z}px)  rotateX(${0}rad) rotateY(${0}rad) rotateZ(${0}rad) translate(-50%, -50%) translate(-50%, -50%)`;
      camera.append(cornerD);
    }

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

let lastActiveTile = null;
function highlightHoveredTile() {
  const newActiveTile = document.elementFromPoint(
    window.innerWidth / 2,
    window.innerHeight / 2,
  );
  if (newActiveTile === viewport) {
    lastActiveTile?.classList.remove("active");
    lastActiveTile = null;
  } else if (lastActiveTile !== newActiveTile) {
    lastActiveTile?.classList.remove("active");
    newActiveTile?.classList.add("active");
    lastActiveTile = newActiveTile;
  }
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("resize", handleResize);
window.addEventListener("blur", handlePointerlockchange);
window.addEventListener("click", handleClick);

document.addEventListener("pointerlockchange", handlePointerlockchange);

const renderLoop = (currentTime, previousTime) => {
  window.requestAnimationFrame((time) => renderLoop(time, currentTime));

  const deltaTime = currentTime - previousTime;
  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  highlightHoveredTile();

  yForceElement.textContent = forces.y;
  posElement.textContent = JSON.stringify(
    Object.fromEntries(
      Object.entries(position).map(([key, val]) => [key, Math.trunc(val)]),
    ),
  );

  camera.style.transform = `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;


};

handleResize();
createTiles();

window.requestAnimationFrame((previousTime) =>
  window.requestAnimationFrame((currentTime) =>
    renderLoop(currentTime, previousTime),
  ),
);
