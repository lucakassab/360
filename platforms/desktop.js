import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

let scene, camera, renderer, controls, sphereMesh, videoElement, texture;
const canvas = document.getElementById('xr-canvas');

// chamado EXPLICITAMENTE pelo core.js
export function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  controls = new OrbitControls(camera, canvas);
  controls.enableZoom = true;
  controls.enablePan = false;

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function clearScene() {
  if (sphereMesh) {
    scene.remove(sphereMesh);
    sphereMesh.geometry.dispose();
    texture?.dispose();
    sphereMesh = null;
  }
  if (videoElement) {
    videoElement.pause();
    videoElement.remove();
    videoElement = null;
  }
}

export async function load(media) {
  clearScene();

  // carrega textura
  if (media.type === 'video') {
    videoElement = document.createElement('video');
    Object.assign(videoElement, { src: media.cachePath, crossOrigin: 'anonymous', loop: true, muted: true });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    texture = await new Promise((res, rej) => {
      new THREE.TextureLoader().load(media.cachePath, res, undefined, rej);
    });
  }

  // stereo top-bottom
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (media.stereo) {
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.encoding = THREE.sRGBEncoding;

  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  sphereMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(sphereMesh);
}

// expõe o renderer pro VRButton
export { renderer };
