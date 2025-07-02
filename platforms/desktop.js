import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

let scene, camera, renderer, controls;
let sphereMesh;
let videoElement;
let texture;

const canvas = document.getElementById('xr-canvas');

init();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    if (texture?.dispose) texture.dispose();
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

  if (media.type === 'video') {
    videoElement = document.createElement('video');
    videoElement.src = media.cachePath;
    videoElement.crossOrigin = 'anonymous';
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.play();

    texture = new THREE.VideoTexture(videoElement);
  } else {
    const loader = new THREE.TextureLoader();
    texture = await new Promise((resolve, reject) => {
      loader.load(media.cachePath, resolve, undefined, reject);
    });
  }

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.encoding = THREE.sRGBEncoding;

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1); // Inverte pra olhar de dentro

  const material = new THREE.MeshBasicMaterial({ map: texture });
  sphereMesh = new THREE.Mesh(geometry, material);
  scene.add(sphereMesh);
}
