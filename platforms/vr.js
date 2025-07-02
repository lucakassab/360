// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { setupVRInputs } from './vr_inputs.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Toggle pra inverter os olhos (debug)
const INVERTER_OLHOS = true;
// 🎛️ Toggle pra mostrar console VR overlay
const SHOW_VR_DEBUG = true;

// variáveis internas pra overlay de debug
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;

function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => {
    ctx.fillText(line, 10, 30 + i * 22);
  });
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;
  
  // Cena e câmera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000
  );
  camera.position.set(0, 0, 0.1);

  // Renderer XR
  renderer = externalRenderer;
  renderer.xr.enabled = true;

  // Se debug, cria overlay
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 512;
    debugCanvas.height = 256;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.4, 0.2);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);
    scene.add(camera);
  }

  // Configura inputs VR A/B
  setupVRInputs(renderer,
    button => logDebug(`Button A pressed`),
    button => logDebug(`Button B pressed`)
  );

  // Loop de render
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  inited = true;
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) precisa rodar antes de load()');
  await loadMedia(media);
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(mesh => {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map && mesh.material.map.dispose();
    mesh.material.dispose();
  });
  if (videoEl) {
    videoEl.pause();
    videoEl.remove();
    videoEl = null;
  }
  texLeft = texRight = null;
  sphereLeft = sphereRight = null;
}

async function loadMedia(media) {
  clearScene();

  // carrega textura
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src: media.cachePath,
      crossOrigin: 'anonymous',
      loop: true,
      muted: true,
      playsInline: true
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
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

  // Geometria
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    return;
  }

  // Stereo top-down
  const repeatStereo = new THREE.Vector2(1, 0.5);
  const offsetTop    = new THREE.Vector2(0, 0);
  const offsetBot    = new THREE.Vector2(0, 0.5);

  [texLeft, texRight].forEach(tex => {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.copy(repeatStereo);
    tex.needsUpdate = true;
  });
  if (!INVERTER_OLHOS) {
    texLeft.offset.copy(offsetTop);
    texRight.offset.copy(offsetBot);
  } else {
    texLeft.offset.copy(offsetBot);
    texRight.offset.copy(offsetTop);
  }

  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // Layers na câmera
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
