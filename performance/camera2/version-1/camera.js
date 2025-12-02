import { perspective } from "./index.js";

export const move = (x, y, z, sceneElement) => {
  sceneElement.style.transformOrigin = `${x}px ${-y}px ${z}px`;
  sceneElement.style.transform = `translate3d(${-x}px, ${y}px, ${-z}px)`;
}

export const rotate = (x, y, z, cameraElement) => {
  cameraElement.style.transform = `translate3d(0px, 0px, ${perspective}px) rotateX(${y}deg) rotateY(${x}deg) rotateZ(${z}deg)`;
}
