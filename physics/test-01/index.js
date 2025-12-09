const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const yForceElement = document.querySelector("#y-force");
const posElement = document.querySelector("#pos");

const userKeys = new Set();

const sensitivity = .2;
const position = { x: 50, y: 500, z: 50 };
const hitbox = { x: 25, y: 100, z: 25 };
const rotation = { x: 0, y: 0, z: 0 };
const forces = { x: 0, y: 0, z: 0 };
let isOnGroup = false;

const fpsValues = Array(20).fill(0);
let fpsIndex = 0;


function handleKeydown({ code, repeat }) {
  if (repeat) {
    return;
  }
  if (code === "Space") {
    if (isOnGroup) {
      forces.y += 11;
    }
  } else if (code === "KeyR") {
    position.x = 50;
    position.y = hitbox.y;
    position.z = 50;
    forces.y = 0;
  } else {
    userKeys.add(code);
  }
};
function handleKeyup({ code }) {
  userKeys.delete(code);
};


const movePlayer = deltaTime => {
  const moveSpeed = 600 * deltaTime / 1000;
  const gravity = 50 * deltaTime / 1000;


  const active = document.querySelectorAll(".tile");
  isOnGroup = false;
  active.forEach(e => {
    const data = get3DPosition(e);
    // Feet are through the floor
    if (
      position.x + hitbox.x >= data.x && position.x - hitbox.x <= data.x + e.clientWidth &&
      position.z + hitbox.z >= data.z && position.z - hitbox.z <= data.z + e.clientHeight &&
      -position.y + hitbox.y >= data.y && -position.y <= data.y
    ) {
      position.y = -data.y + hitbox.y;
      isOnGroup = true;
    }
  });

  if (!isOnGroup) {
    forces.y = Math.max(forces.y - gravity, -100);
  } else {
    forces.y = Math.max(forces.y, 0);
  }

  position.y += forces.y;


  if (userKeys.has("KeyW")) {
    position.z += moveSpeed * Math.cos((rotation.x + 180) * Math.PI / 180)
    position.x += moveSpeed * Math.sin(rotation.x * Math.PI / 180)
  }
  if (userKeys.has("KeyA")) {
    position.z += moveSpeed * Math.cos((rotation.x + 90) * Math.PI / 180)
    position.x += moveSpeed * Math.sin((rotation.x - 90) * Math.PI / 180)
  }
  if (userKeys.has("KeyS")) {
    position.z += moveSpeed * Math.cos(rotation.x * Math.PI / 180)
    position.x += moveSpeed * Math.sin((rotation.x + 180) * Math.PI / 180)
  }
  if (userKeys.has("KeyD")) {
    position.z += moveSpeed * Math.cos((rotation.x - 90) * Math.PI / 180);
    position.x += moveSpeed * Math.sin((rotation.x + 90) * Math.PI / 180);
  }

  // if (userKeys.has("Space")) position.y += moveSpeed;
  // if (userKeys.has("ShiftLeft")) position.y -= moveSpeed;
}

function handleMouseMove(event) {
  rotation.x += (event?.movementX ?? 0) * sensitivity;
  rotation.y -= (event?.movementY ?? 0) * sensitivity;
  rotation.y = Math.min(90, Math.max(rotation.y, -90));
}

function createTiles(size) {
  camera.textContent = "";
  const floor = document.createElement("div");
  floor.classList.add("tile");
  floor.style.pointerEvents = "none";
  floor.style.transform = `translate3d(0px, 50px, 200px) rotateX(90deg)`;
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

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const div = document.createElement("div");
      div.classList.add("tile");
      div.style.transform = `translate3d(${x * (1000 / size)}px, ${x * z * (25 / size)}px, ${z * -(1000 / size)}px) rotateX(90deg)`;
      div.style.backgroundColor = `rgb(${x / size * 255}, ${Math.sqrt(x, z) / size * 255}, ${z / size * 255})`;
      camera.append(div);
    }
  }
}


function get3DPosition(el) {
  const transform = getComputedStyle(el).transform;

  if (transform === 'none') {
    return { x: 0, y: 0, z: 0 };
  }

  const values = transform.match(/matrix3d\((.+)\)/)[1].split(',').map(Number);

  return {
    scaleX: values[0],
    scaleZ: values[6],
    x: values[12],
    y: values[13],
    z: values[14]
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

function handleClick(e) {
  const activeElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (activeElement !== viewport) {
    activeElement?.classList.toggle("clicked");
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
  const perspective = Math.round(Math.pow(w / 2 * w / 2 + h / 2 * h / 2, 0.5) / Math.tan((FOV / 2) * Math.PI / 180));
  viewport.style.setProperty("--perspective", perspective + "px");
}

let lastActiveTile = null;
function highlightHoveredTile() {
  const newActiveTile = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (newActiveTile === viewport) {
    lastActiveTile?.classList.remove("active");
    lastActiveTile = null;
  }
  else if (lastActiveTile !== newActiveTile) {
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
  window.requestAnimationFrame(time => renderLoop(time, currentTime));

  const deltaTime = currentTime - previousTime;
  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  highlightHoveredTile();

  yForceElement.textContent = forces.y;
  posElement.textContent = JSON.stringify(position);


  camera.style.transform = `rotateX(${rotation.y}deg) rotateY(${rotation.x}deg) rotateZ(${rotation.z}deg) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
}

handleResize();
createTiles(4);

window.requestAnimationFrame(previousTime => window.requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
