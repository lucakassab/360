// platforms/desktop.js
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

export let renderer;
let scene, camera, controls, sphereMesh, videoElement, texture;

const DEBUG_DESKTOP = false;
const desktopLogs = [];

// Log helper
function desktopLog(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  console.log(msg);
  if (DEBUG_DESKTOP) {
    desktopLogs.push(msg);
    const dbg = document.getElementById('desktop-debug-log');
    if (dbg) {
      const line = document.createElement('div');
      line.textContent = msg;
      dbg.appendChild(line);
      dbg.scrollTop = dbg.scrollHeight;
    }
  }
}

export async function init({ container }) {
  // Clear container
  container.innerHTML = '';

  // Three.js setup
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enablePan = false;

  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });

  animate();
}

export async function load(media) {
  desktopLog('Loading:', media.name);

  // Remove previous mesh
  if (sphereMesh) {
    scene.remove(sphereMesh);
    sphereMesh.geometry.dispose();
    sphereMesh.material.map.dispose();
    sphereMesh.material.dispose();
    sphereMesh = null;
  }
  // Stop and remove previous video element
  if (videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement.load();
    videoElement = null;
  }

  // Create texture or video
  if (media.type === 'video') {
    videoElement = document.createElement('video');
    videoElement.src = media.cachePath || media.src;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.preload = 'auto';
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    // Single texture load
    texture = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(media.cachePath || media.src, res, undefined, rej)
    );
  }

  // Common texture settings
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAniso;

  // Stereo: show top half only
  if (media.stereo) {
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0.5);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  // Create sphere mesh
  const geo = new THREE.SphereGeometry(500, 128, 64);
  geo.scale(-1, 1, 1);
  sphereMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(sphereMesh);

  desktopLog('Media added');
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Inject VR logs into desktop (optional)
export function appendLogs(vrLogs) {
  vrLogs.forEach(msg => desktopLog(msg));
}
