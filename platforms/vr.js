// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, renderer;
let inited = false;

// Debug HUD
let debugCanvas, debugMesh, debugCtx;
let debugLogs = [];
const MAX_LOGS = 10;
let prevButtonPressed = false;

// Pano/Vídeo
let sphereLeft = null, sphereRight = null, videoEl = null;
let texLeft = null, texRight = null;

// Toggles
const SHOW_LEFT_CONTROLLER  = true;
const SHOW_RIGHT_CONTROLLER = true;
const SHOW_VR_DEBUG         = true;
const INVERTER_OLHOS        = true;

// Controller references
let gripL = null, gripR = null;

function logDebug(msg) {
  debugLogs.push(`[${performance.now().toFixed(0)}ms] ${msg}`);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  if (debugCtx) {
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugCtx.fillStyle = '#0f0';
    debugCtx.font = '24px monospace';
    debugLogs.forEach((m, i) => {
      debugCtx.fillText(m, 10, 30 + i * 30);
    });
  }
}

export async function initXR(extRenderer) {
  if (inited) return;
  renderer = extRenderer;
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);

  // Cena e câmera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);
  scene.add(camera);

  // Luz mínima pro StandardMaterial aparecer
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(1, 2, 1);
  scene.add(dir);

  // SpotLight que você já tinha
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI / 6, 0.25);
  spot.position.set(0, 2.2, 0);
  spot.target.position.set(0, 0, -1);
  camera.add(spot);
  camera.add(spot.target);

  // Debug HUD
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 1024;
    debugCanvas.height = 512;
    debugCtx = debugCanvas.getContext('2d');
    const tex = new THREE.CanvasTexture(debugCanvas);
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.visible = false;
    debugMesh.position.set(0, -0.1, -0.6);
    camera.add(debugMesh);
    logDebug('Debug HUD initialized');
  }

  // Factory e controls
  const factory = new XRControllerModelFactory();

  // remove ray-standard
  [0,1].forEach(i => {
    const ctrl = renderer.xr.getController(i);
    if (ctrl) ctrl.visible = false;
  });

  // helper material branco
  const applyWhite = model => {
    model.traverse(o => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.3,
          metalness: 0.4
        });
      }
    });
  };

  // grip esquerdo
  if (SHOW_LEFT_CONTROLLER) {
    gripL = renderer.xr.getControllerGrip(0);
    gripL.visible = false;
    gripL.addEventListener('connected', () => {
      gripL.visible = true;
      gripL.clear && gripL.clear();
      const model = factory.createControllerModel(gripL);
      applyWhite(model);
      gripL.add(model);
      logDebug('Grip L connected');
    });
    gripL.addEventListener('disconnected', () => {
      gripL.visible = false;
      while (gripL.children.length) gripL.remove(gripL.children[0]);
      logDebug('Grip L disconnected');
    });
    scene.add(gripL);
  }

  // grip direito
  if (SHOW_RIGHT_CONTROLLER) {
    gripR = renderer.xr.getControllerGrip(1);
    gripR.visible = false;
    gripR.addEventListener('connected', () => {
      gripR.visible = true;
      gripR.clear && gripR.clear();
      const model = factory.createControllerModel(gripR);
      applyWhite(model);
      gripR.add(model);
      logDebug('Grip R connected');
    });
    gripR.addEventListener('disconnected', () => {
      gripR.visible = false;
      while (gripR.children.length) gripR.remove(gripR.children[0]);
      logDebug('Grip R disconnected');
    });
    scene.add(gripR);
  }

  // render loop
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // toggle HUD com B
    let pressed = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3].pressed) pressed = true;
    });
    if (pressed && !prevButtonPressed) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`HUD ${debugMesh.visible ? 'on' : 'off'}`);
    }
    prevButtonPressed = pressed;

    // fallback visibility
    let left   = false;
    let right  = false;
    session.inputSources.forEach(src => {
      if (src.handedness === 'left')  left  = true;
      if (src.handedness === 'right') right = true;
    });
    if (gripL) gripL.visible = left  && SHOW_LEFT_CONTROLLER;
    if (gripR) gripR.visible = right && SHOW_RIGHT_CONTROLLER;
  });

  inited = true;
  logDebug('initXR complete');
}

export async function load(media) {
  if (!inited) throw new Error('Call initXR first');
  logDebug(`Loading media: ${media.name}`);
  // seu loadMedia aqui, se precisar
  logDebug('✅ loadMedia concluído');
}
