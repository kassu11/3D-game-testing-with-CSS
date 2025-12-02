const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const w = window.innerWidth;
const h = window.innerHeight;
const FOV = 120;
const perspective = Math.round(Math.pow(w / 2 * w / 2 + h / 2 * h / 2, 0.5) / Math.tan((FOV / 2) * Math.PI / 180));
viewport.style.setProperty("--perspective", perspective + "px");

const sensitivity = .2;
const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };

const SIZE = 30;
for (let x = 0; x < SIZE; x++) {
  for (let z = 0; z < SIZE; z++) {
    const div = document.createElement("div");
    div.classList.add("tile");
    div.style.transform = `translate3d(${x * (1000 / SIZE)}px, ${x * z * (25 / SIZE)}px, ${z * -(1000 / SIZE)}px) rotateX(90deg)`;
    div.style.backgroundColor = `rgb(${x / SIZE * 255}, ${Math.sqrt(x, z) / SIZE * 255}, ${z / SIZE * 255})`;
    camera.append(div);
  }
}

const userKeys = new Set();

window.addEventListener("keydown", ({ code, repeat }) => {
  if (repeat) {
    return;
  }

  userKeys.add(code);
});

window.addEventListener("keyup", ({ code }) => userKeys.delete(code));
window.onblur = () => userKeys.clear();

const movePlayer = deltaTime => {
  const moveSpeed = 600 * deltaTime / 1000;

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

  if (userKeys.has("Space")) position.y += moveSpeed;
  if (userKeys.has("ShiftLeft")) position.y -= moveSpeed;
}

const renderLoop = (currentTime, previousTime) => {
  window.requestAnimationFrame(time => renderLoop(time, currentTime));

  const deltaTime = currentTime - previousTime;
  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  camera.style.transform = `rotateX(${rotation.y}deg) rotateY(${rotation.x}deg) rotateZ(${rotation.z}deg) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
}

const fpsValues = Array(20).fill(0);
let fpsIndex = 0;
function updateFpsCounter(deltaTime) {
  fpsValues[fpsIndex++ % fpsValues.length] = deltaTime;
  const sum = fpsValues.reduce((acc, v) => acc + v);
  fps.textContent = Math.round((1000 * fpsValues.length) / sum);
}

document.body.onclick = () => !document.pointerLockElement && document.body.requestPointerLock({ unadjustedMovement: true });
document.addEventListener("pointerlockerror", () => console.error("Error locking pointer"));

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) {
    document.addEventListener("mousemove", handleMouseMove);
  } else {
    document.removeEventListener("mousemove", handleMouseMove);
    userKeys.clear();
  }
});

function handleMouseMove(event) {
  rotation.x += (event?.movementX ?? 0) * sensitivity;
  rotation.y -= (event?.movementY ?? 0) * sensitivity;
  rotation.y = Math.min(90, Math.max(rotation.y, -90));
}

window.requestAnimationFrame(previousTime => window.requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
