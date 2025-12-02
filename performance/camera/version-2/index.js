const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const w = window.innerWidth;
const h = window.innerHeight;
const FOV = 120;
const perspective = Math.round(Math.pow( w/2*w/2 + h/2*h/2, 0.5 ) / Math.tan( (FOV / 2) * Math.PI / 180 ));
viewport.style.setProperty("--perspective", perspective + "px");

const sensitivity = .2;
const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };

for (let x = 0; x < 50; x++) {
  for (let z = 0; z < 50; z++) {
    const div = document.createElement("div");
    div.classList.add("tile");
    div.style.transform = `translate3d(${x * 100}px, ${x * z * 5}px, ${z * -100}px) rotateX(90deg)`;
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
  camera.style.transform = `rotateX(${rotation.y}deg) rotateY(${rotation.x}deg) rotateZ(${rotation.z}deg) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
}

document.body.onclick = () => !document.pointerLockElement && document.body.requestPointerLock({ unadjustedMovement: true });
document.addEventListener("pointerlockerror", () => console.error("Error locking pointer"));

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) {
    document.addEventListener("mousemove", mouseMovement);
  } else {
    document.removeEventListener("mousemove", mouseMovement);
    userKeys.clear();
  }
});

function mouseMovement(event) {
  rotation.x += (event?.movementX ?? 0) * sensitivity;
  rotation.y -= (event?.movementY ?? 0) * sensitivity;
  rotation.y = Math.min(90, Math.max(rotation.y, -90));
}

window.requestAnimationFrame(previousTime => window.requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
