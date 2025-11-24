export const translate = (position, rotation, cameraElement) => {
  cameraElement.style.transform = `rotateX(${rotation.y}deg) rotateY(${rotation.x}deg) rotateZ(${rotation.z}deg) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
}
