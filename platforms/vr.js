// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Toggles
const SHOW_LEFT_CONTROLLER  = true;
const SHOW_RIGHT_CONTROLLER = true;
const INVERTER_OLHOS        = true;
const SHOW_VR_DEBUG         = true;

// Debug HUD vars
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;
let prevButtonPressed = false;

function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => ctx.fillText(line, 10, 30 + i * 22));
  debugTexture.needsUpdate = true;
}

export async function initXR(extRenderer) {
  if (inited) return;

  // Renderer setup
  renderer = extRenderer;
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);

  // Scene & camera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
  scene.add(camera);

  // Lights for visibility
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 2, 2);
  scene.add(dir);

  // Debug HUD
  if (SHOW_VR_DEBUG) {
    debugCanvas = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 });
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.15, -0.6);
    camera.add(debugMesh);
    logDebug('🎮 Debug HUD inicializado');
  }

  // XR controller models
  const factory = new XRControllerModelFactory();
  const setupGrip = (index, showToggle) => {
    if (!showToggle) return;
    const grip = renderer.xr.getControllerGrip(index);
    const model = factory.createControllerModel(grip);
    grip.add(model);
    grip.visible = false;
    scene.add(grip);
    grip.addEventListener('connected', () => { grip.visible = true; logDebug(`Grip ${index} ON`); });
    grip.addEventListener('disconnected', () => { grip.visible = false; logDebug(`Grip ${index} OFF`); });
  };
  setupGrip(0, SHOW_LEFT_CONTROLLER);
  setupGrip(1, SHOW_RIGHT_CONTROLLER);

  // Render loop
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  inited = true;
  logDebug('🚀 initXR concluído');
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug('✅ loadMedia concluído');
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(mesh => {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map?.dispose();
    mesh.material.dispose();
  });
  if (videoEl) {
    videoEl.pause(); videoEl.src = ''; videoEl.load(); videoEl.remove(); videoEl = null;
  }
  texLeft?.dispose?.();
  texRight?.dispose?.();
  sphereLeft = sphereRight = texLeft = texRight = null;
  logDebug('🧹 Cena limpa');
}

async function loadMedia(media) {
  clearScene();
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, { src: media.cachePath, crossOrigin: 'anonymous', loop: true, muted: true, playsInline: true });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const base = await new Promise((res, rej) => new THREE.TextureLoader().load(media.cachePath, res, undefined, rej));
    texLeft = base;
    texRight = media.stereo ? base.clone() : null;
  }
  [texLeft, texRight].forEach(t => {
    if (!t) return;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
  });
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0;
    const bot = INVERTER_OLHOS ? 0 : 0.5;
    texLeft.repeat.set(1, 0.5); texLeft.offset.set(0, top);
    texRight.repeat.set(1, 0.5); texRight.offset.set(0, bot);
  } else {
    texLeft.repeat.set(1, 1); texLeft.offset.set(0, 0);
  }
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);
  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
  } else {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.set(1); scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereRight.layers.set(2); scene.add(sphereRight);
  }
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
