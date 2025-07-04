// desktop.js
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

export let renderer;
let scene, camera, controls, sphereMesh, videoElement, texture;
const canvas = document.getElementById('xr-canvas');
const INVERTER_OLHOS = true;

export function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio * 2);

  controls = new OrbitControls(camera, canvas);
  controls.enableZoom = true;
  controls.enablePan = false;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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

  // carrega vídeo ou imagem
  if (media.type === 'video') {
    videoElement = document.createElement('video');
    Object.assign(videoElement, {
      src: media.cachePath,
      crossOrigin: 'anonymous',
      loop: true,
      muted: true,
      playsInline: true
    });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    texture = await new Promise((res, rej) => {
      new THREE.TextureLoader().load(media.cachePath, res, undefined, rej);
    });
  }

  // configurações de qualidade máxima
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAniso;

  // split stereo top/bottom
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, top);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  // esfera 360 de alta resolução
  const geo = new THREE.SphereGeometry(500, 128, 64);
  geo.scale(-1, 1, 1);

  sphereMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(sphereMesh);
}
