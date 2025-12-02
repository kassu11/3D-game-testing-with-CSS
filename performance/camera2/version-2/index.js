const viewport = document.querySelector("#viewport");
const camera = document.querySelector("#camera");
const sizeInput = document.querySelector("#size");
const animateCheckbox = document.querySelector("#animate");
const borderCheckbox = document.querySelector("#border");

const userKeys = new Set();

const sensitivity = .2;
const position = { x: 0, y: 0, z: 0 };
const rotation = { x: 0, y: 0, z: 0 };

const fpsValues = Array(20).fill(0);
let fpsIndex = 0;


function handleKeydown({ code, repeat }) {
  if (!repeat) {
    userKeys.add(code);
  }
};
function handleKeyup({ code }) {
  userKeys.delete(code);
};


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

function handleMouseMove(event) {
  rotation.x += (event?.movementX ?? 0) * sensitivity;
  rotation.y -= (event?.movementY ?? 0) * sensitivity;
  rotation.y = Math.min(90, Math.max(rotation.y, -90));
}

function createTiles(size) {
  camera.textContent = "";
  sizeInput.value = size;
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

function updateFpsCounter(deltaTime) {
  fpsValues[fpsIndex++ % fpsValues.length] = deltaTime;
  const sum = fpsValues.reduce((acc, v) => acc + v);
  fps.textContent = Math.round((1000 * fpsValues.length) / sum);
}



function handleEnterPointerLock(e) {
  if (document.pointerLockElement || animateCheckbox.checked) {
    return;
  }
  if (e?.target?.closest(".info-wrapper")) {
    return;
  }

  document.body.requestPointerLock({ unadjustedMovement: true });
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

function handleAnimateChange(e) {
  document.body.classList.toggle("animate", e.target.checked);
  e.target.blur();
  handleEnterPointerLock()
}
const handleBorderChange = (e) => document.body.classList.toggle("border", e.target.checked);
const handleSizeInput = (e) => createTiles(+e.target.value);

animateCheckbox.addEventListener("change", handleAnimateChange);
borderCheckbox.addEventListener("change", handleBorderChange);
sizeInput.addEventListener("input", handleSizeInput);

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("resize", handleResize);
window.addEventListener("blur", handlePointerlockchange);
window.addEventListener("click", handleEnterPointerLock);

document.addEventListener("pointerlockchange", handlePointerlockchange);


const renderLoop = (currentTime, previousTime) => {
  window.requestAnimationFrame(time => renderLoop(time, currentTime));

  const deltaTime = currentTime - previousTime;
  movePlayer(deltaTime);
  updateFpsCounter(deltaTime);
  camera.style.transform = `rotateX(${rotation.y}deg) rotateY(${rotation.x}deg) rotateZ(${rotation.z}deg) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
}

handleResize();
createTiles(32);

window.requestAnimationFrame(previousTime => window.requestAnimationFrame(currentTime => renderLoop(currentTime, previousTime)));
