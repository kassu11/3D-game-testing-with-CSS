export const move = (x, y, z, sceneElement) => {
  sceneElement.style.translate = `${-x}px ${y}px ${-z}px`;
}

export const rotate = (x, y, z, cameraElement) => {
  cameraElement.style.transform = `rotateX(${y}deg) rotateY(${x}deg) rotateZ(${z}deg)`;
}
