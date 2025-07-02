// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, renderer;
let inited = false;

// Debug HUD
let debugCanvas, debugMesh, debugCtx, debugTexture;
let debugLogs = [];
const MAX_LOGS = 10;
let prevButtonPressed = false;

// Controller detection flags
let prevFoundLeft = false;
let prevFoundRight = false;

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
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => ctx.fillText(line, 10, 30 + i * 22));
  if (debugTexture) debugTexture.needsUpdate = true;
}

export async function initXR(extRenderer) {
  if (inited) return;
  renderer = extRenderer;
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);

  // Scene & camera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);
  scene.add(camera);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 2, 1);
  scene.add(dir);
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI / 6, 0.25);
  spot.position.set(0, 2.2, 0);
  spot.target.position.set(0, 0, -1);
  camera.add(spot, spot.target);

  // Debug HUD
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 2048;
    debugCanvas.height = 1024;
    debugCtx = debugCanvas.getContext('2d');
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);
    logDebug('🎮 Debug HUD inicializado');
  }

  const factory = new XRControllerModelFactory();

  // Hide default rays
  [0, 1].forEach(i => {
    const c = renderer.xr.getController(i);
    if (c) c.visible = false;
  });

  // Helper: add controller model, log meshes
  const addController = (grip, label) => {
    const model = factory.createControllerModel(grip);
    model.traverse(o => {
      if (o.isMesh) {
        logDebug(`${label} mesh carregada: ${o.name || o.uuid}`);
        o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 });
      }
    });
    grip.add(model);
  };

  // Left grip
  if (SHOW_LEFT_CONTROLLER) {
    gripL = renderer.xr.getControllerGrip(0);
    addController(gripL, 'Esquerdo');
    gripL.visible = false;
    scene.add(gripL);
  }

  // Right grip
  if (SHOW_RIGHT_CONTROLLER) {
    gripR = renderer.xr.getControllerGrip(1);
    addController(gripR, 'Direito');
    gripR.visible = false;
    scene.add(gripR);
  }

  // Render loop
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // HUD toggle with B
    let pressed = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3].pressed) pressed = true;
    });
    if (pressed && !prevButtonPressed) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
    }
    prevButtonPressed = pressed;

    // Controller detection & logging
    let foundLeft = false, foundRight = false;
    session.inputSources.forEach(src => {
      if (src.handedness === 'left')  foundLeft  = true;
      if (src.handedness === 'right') foundRight = true;
    });
    if (foundLeft && !prevFoundLeft) logDebug('Controle esquerdo detectado');
    if (!foundLeft && prevFoundLeft) logDebug('Controle esquerdo perdido');
    if (foundRight && !prevFoundRight) logDebug('Controle direito detectado');
    if (!foundRight && prevFoundRight) logDebug('Controle direito perdido');
    prevFoundLeft  = foundLeft;
    prevFoundRight = foundRight;
    if (gripL) gripL.visible = foundLeft;
    if (gripR) gripR.visible = foundRight;
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
  [sphereLeft, sphereRight].forEach(m => {
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  });
  if (videoEl) {
    videoEl.pause();
    videoEl.src = '';
    videoEl.load();
    videoEl.remove();
    videoEl = null;
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
    texLeft.repeat.set(1, 0.5);
    texLeft.offset.set(0, top);
    texRight.repeat.set(1, 0.5);
    texRight.offset.set(0, bot);
    texLeft.needsUpdate = texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
  }
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);
  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
  } else {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.set(1);
    scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereRight.layers.set(2);
    scene.add(sphereRight);
  }
  const xrCam = renderer.xr.get
