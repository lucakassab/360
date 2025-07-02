// vr.js (sem alterações, ele faz initXR + load stereo/mono)
import * as THREE from '../libs/three.module.js';
import { VRButton } from '../libs/VRButton.js'; // já patchado

let scene, camera, renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let initialized = false;

export async function load(media) {
  if (!initialized) {
    await initXR();
    initialized = true;
  }
  await loadMedia(media);
}

async function initXR() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('xr-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  document.body.appendChild(VRButton.createButton(renderer));
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(m => {
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  });
  if (videoEl) { videoEl.pause(); videoEl.remove(); videoEl = null; }
  texLeft = texRight = null;
  sphereLeft = sphereRight = null;
}

async function loadMedia(media) {
  clearScene();

  // cria as texturas
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    videoEl.src = media.cachePath;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((r, e) => loader.load(media.cachePath, r, undefined, e));
    base.mapping  = THREE.EquirectangularReflectionMapping;
    base.encoding = THREE.sRGBEncoding;
    if (media.stereo) {
      texLeft  = base.clone();
      texRight = base.clone();
    } else {
      texLeft  = base;
      texRight = null;
    }
  }

  // ajusta corte/offset
  if (media.stereo) {
    texLeft.repeat.set(0.5, 1);
    texLeft.offset.set(0, 0);
    texRight.repeat.set(0.5, 1);
    texRight.offset.set(0.5, 0);
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
  }
  texLeft.needsUpdate = true;
  texRight?.needsUpdate = true;

  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    const mat = new THREE.MeshBasicMaterial({ map: texLeft });
    sphereLeft = new THREE.Mesh(geo, mat);
    scene.add(sphereLeft);
    return;
  }

  const matL = new THREE.MeshBasicMaterial({ map: texLeft });
  sphereLeft = new THREE.Mesh(geo, matL);
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  const matR = new THREE.MeshBasicMaterial({ map: texRight });
  sphereRight = new THREE.Mesh(geo, matR);
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
