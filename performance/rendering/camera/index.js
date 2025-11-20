import { move, rotate } from "./camera.js";

const viewport = document.querySelector("#viewport");
const scene = document.querySelector("#scene");
const camera = document.querySelector("#camera");
const w = window.innerWidth;
const h = window.innerHeight;
// export const perspective = 400;
const FOV = 120;
const perspective = Math.pow( w/2*w/2 + h/2*h/2, 0.5 ) / Math.tan( (FOV / 2) * Math.PI / 180 );
viewport.style.setProperty("--perspective", perspective + "px");

const sensitivity = .2;
const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };

for (let i = 0; i < 100; i++) {
  const div = document.createElement("div");
  div.classList.add("tile");
  div.style.transform = `translate3d(200px, 200px, ${-i * 10}px)`;
  scene.append(div);
}

for (let x = 0; x < 1; x++) {
  for (let z = 0; z < 1; z++) {
    const div = document.createElement("div");
    div.classList.add("tile", "floor");
    div.style.transform = `translate3d(${x * 1000}px, 500px, ${z * -1000}px) rotateX(90deg)`;
    scene.append(div);
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
  // Movement speed is 250 units in second
  const moveSpeed = 250 * deltaTime / 1000;

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

  move(position.x, position.y, position.z, scene);
}


const renderLoop = (currentTime, previousTime) => {
  window.requestAnimationFrame(time => renderLoop(time, currentTime));

  const deltaTime = currentTime - previousTime;
  movePlayer(deltaTime);
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

  // camera.updateRotation();
  rotate(rotation.x, rotation.y, rotation.z, camera);
}

window.requestAnimationFrame(previousTime => window.requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
