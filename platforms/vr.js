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

let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;
let prevButtonPressed = false;

// refs pros grips
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
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;

  // Cena e câmera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // SpotLight potente
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI/6, 0.25);
  spot.position.set(0, 2.2, 0);
  spot.target.position.set(0, 0, -1);
  camera.add(spot);
  camera.add(spot.target);
  scene.add(camera);

  // Debug HUD
  if (SHOW_VR_DEBUG) {
    debugCanvas  = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);

    const ua = navigator.userAgent.toLowerCase();
    const device =
      ua.includes('quest pro') ? 'Meta Quest Pro' :
      ua.includes('quest 3')   ? 'Meta Quest 3'  :
      ua.includes('quest 2')   ? 'Meta Quest 2'  :
      ua.includes('quest')     ? 'Meta Quest'    :
      ua.includes('oculusbrowser') ? 'Oculus Browser' : 'Desconhecido';
    logDebug(`🎮 Dispositivo XR: ${device}`);
  }

  const factory = new XRControllerModelFactory();

  // helper para aplicar material branco
  const applyWhiteMaterial = model => {
    model.traverse(o => {
      if (o.isMesh) o.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.4
      });
    });
  };

  // esconde target-ray padrão
  [0, 1].forEach(i => renderer.xr.getController(i).visible = false);

  // configura grip esquerdo
  if (SHOW_LEFT_CONTROLLER) {
    gripL = renderer.xr.getControllerGrip(0);
    gripL.visible = false;
    gripL.addEventListener('connected', () => {
      gripL.visible = true;
      gripL.clear && gripL.clear();
      const model = factory.createControllerModel(gripL);
      applyWhiteMaterial(model);
      gripL.add(model);
    });
    gripL.addEventListener('disconnected', () => {
      gripL.visible = false;
      while (gripL.children.length) gripL.remove(gripL.children[0]);
    });
    scene.add(gripL);
  }

  // configura grip direito
  if (SHOW_RIGHT_CONTROLLER) {
    gripR = renderer.xr.getControllerGrip(1);
    gripR.visible = false;
    gripR.addEventListener('connected', () => {
      gripR.visible = true;
      gripR.clear && gripR.clear();
      const model = factory.createControllerModel(gripR);
      applyWhiteMaterial(model);
      gripR.add(model);
    });
    gripR.addEventListener('disconnected', () => {
      gripR.visible = false;
      while (gripR.children.length) gripR.remove(gripR.children[0]);
    });
    scene.add(gripR);
  }

  // Loop de renderização
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // Toggle HUD com botão B
    let btnPressedNow = false;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (gp && gp.buttons.length >= 4 && gp.buttons[3].pressed) btnPressedNow = true;
    }
    if (btnPressedNow && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
    }
    prevButtonPressed = btnPressedNow;

    // Autodetecção de controles
    let foundLeft = false, foundRight = false;
    for (const src of session.inputSources) {
      if (src.handedness === 'left')  foundLeft  = true;
      if (src.handedness === 'right') foundRight = true;
    }
    if (gripL) gripL.visible = foundLeft  && SHOW_LEFT_CONTROLLER;
    if (gripR) gripR.visible = foundRight && SHOW_RIGHT_CONTROLLER;
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
    texLeft = base; texRight = media.stereo ? base.clone() : null;
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
    const top = INVERTER_OLHOS ? 0.5 : 0.0, bot = INVERTER_OLHOS ? 0.0
