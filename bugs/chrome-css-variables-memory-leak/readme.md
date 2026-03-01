# Memory leak when using CSS variables

> [!IMPORTANT]
> PC specs: RTX 3070, 16 GB of DDR5 RAM, i7-12700F
> Browser version used
> Brave 1.85.116 (Official Build) (64-bit)
> Chromium: 143.0.7499.110

- Application runs in smooth 144 FPS when first opened
- After running ~10 seconds the fps starts to drop and it keeps going down
  - This does not happen if you replace the setProperty code with something like this 
  
```js
// camera.style.setProperty("--rotation-x", `${rotation.x}rad`);
// camera.style.setProperty("--rotation-y", `${rotation.y}rad`);
// camera.style.setProperty("--rotation-z", `${rotation.z}rad`);
// camera.style.setProperty("--position-x", `${-position.x}px`);
// camera.style.setProperty("--position-y", `${position.y}px`);
// camera.style.setProperty("--position-z", `${-position.z}px`);

// This would also cause the memory leak
// camera.style.cssText = `
// --rotation-x: ${rotation.x}rad;
// --rotation-y: ${rotation.y}rad;
// --rotation-z: ${rotation.z}rad;
// --position-x: ${-position.x}px;
// --position-y: ${position.y}px;
// --position-z: ${-position.z}px;
// `;

// Does not leak memory
camera.style.transform = `rotateX(${rotation.x}rad) rotateY(${rotation.y}rad) rotateZ(${rotation.z}rad) translate3d(${-position.x}px, ${position.y}px, ${-position.z}px)`;
```

- FPS does not drop in Firefox and everything works just as expected

> NONE: After upgrading my RAM to 64 GB the issue is much less noticable
