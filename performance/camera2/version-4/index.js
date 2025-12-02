const scene = document.getElementById("scene");
const room = document.getElementById("room");
const fps = document.getElementById("fps");

const sensitivity = .01;
const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };

const userKeys = new Set();

window.addEventListener("keydown", ({ code, repeat }) => {
  if (!repeat) {
    userKeys.add(code);
  }
});

window.addEventListener("keyup", ({ code }) => userKeys.delete(code));
window.addEventListener("blur", () => userKeys.clear());

const movePlayer = deltaTime => {
  const moveSpeed = 600 * deltaTime / 1000;

  if (userKeys.has("KeyW")) {
    position.z -= moveSpeed * Math.cos(rotation.y);
    position.x += moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyA")) {
    position.z -= moveSpeed * Math.sin(rotation.y)
    position.x -= moveSpeed * Math.cos(rotation.y)
  }
  if (userKeys.has("KeyS")) {
    position.z += moveSpeed * Math.cos(rotation.y);
    position.x -= moveSpeed * Math.sin(rotation.y);
  }
  if (userKeys.has("KeyD")) {
    position.z += moveSpeed * Math.sin(rotation.y)
    position.x += moveSpeed * Math.cos(rotation.y)
  }

  if (userKeys.has("Space")) position.y += moveSpeed;
  if (userKeys.has("ShiftLeft")) position.y -= moveSpeed;
}

document.body.onclick = () => !document.pointerLockElement && document.body.requestPointerLock({ unadjustedMovement: true });
window.addEventListener("click", () => {
  if (!document.pointerLockElement) {
    document.body.requestPointerLock({ unadjustedMovement: true })
  }
});
document.addEventListener("pointerlockerror", () => console.error("Error locking pointer"));
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) {
    document.addEventListener("mousemove", mouseHandler);
  } else {
    document.removeEventListener("mousemove", mouseHandler);
    userKeys.clear();
  }
});

function mouseHandler(e) {
  rotation.y += e.movementX * sensitivity;
  rotation.x -= e.movementY * sensitivity;
  rotation.x = Math.min(Math.PI / 2, Math.max(rotation.x, -Math.PI / 2));
}

const fpsValues = Array(20).fill(0);
let fpsIndex = 0;
function fpsCounter(deltaTime) {
  fpsValues[fpsIndex++ % fpsValues.length] = deltaTime;
  const sum = fpsValues.reduce((acc, v) => acc + v);
  fps.textContent = Math.round((1000 * fpsValues.length) / sum);
}

requestAnimationFrame(previousTime => requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
const renderLoop = (currentTime, previousTime) => {
  requestAnimationFrame(time => renderLoop(time, currentTime));
  const deltaTime = currentTime - previousTime;

  movePlayer(deltaTime);
  fpsCounter(deltaTime);


  scene.style.transform =
    "translateZ(800px)" +
    "rotateX(" +
    rotation.x +
    "rad)" +
    "rotateY(" +
    rotation.y +
    "rad)";

  room.style.transform =
    "translate3d(" + -position.x + "px," + position.y + "px," + -position.z + "px)";

}

for (let x = 0; x < 30; x++) {
  for (let z = 0; z < 30; z++) {
    const tile = document.createElement("div");
    tile.classList.add("obj3d", "tile");
    tile.style.transform = `translate3d(${x * 100}px, ${x * z * 5}px, ${z * -100}px) rotateX(90deg)`;
    room.append(tile);
  }
}
