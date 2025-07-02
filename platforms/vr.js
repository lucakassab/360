
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
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
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
  camera.add(spot, spot.target);
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
  const applyMat = model => model.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.4
    });
  });

  // configura grips
  if (SHOW_LEFT_CONTROLLER) {
    gripL = renderer.xr.getControllerGrip(0);
    gripL.visible = false;
    gripL.addEventListener('connected', () => {
      gripL.visible = true;
      // limpa filhos antigos
      gripL.clear && gripL.clear(); 
      const model = factory.createControllerModel(gripL);
      applyMat(model);
      gripL.add(model);
    });
    gripL.addEventListener('disconnected', () => {
      gripL.visible = false;
    });
    scene.add(gripL);
  }
  if (SHOW_RIGHT_CONTROLLER) {
    gripR = renderer.xr.getControllerGrip(1);
    gripR.visible = false;
    gripR.addEventListener('connected', () => {
      gripR.visible = true;
      gripR.clear && gripR.clear();
      const model = factory.createControllerModel(gripR);
      applyMat(model);
      gripR.add(model);
    });
    gripR.addEventListener('disconnected', () => {
      gripR.visible = false;
    });
    scene.add(gripR);
  }

  // Loop de renderização
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // Toggle HUD com botão B
    let now = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3].pressed) now = true;
    });
    if (now && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
    }
    prevButtonPressed = now;

    // Autodetecta visibilidade (fallback)
    let left = false, right = false;
    session.inputSources.forEach(src => {
      if (src.handedness === 'left')  left  = true;
      if (src.handedness === 'right') right = true;
    });
    if (gripL) gripL.visible = left && SHOW_LEFT_CONTROLLER;
    if (gripR) gripR.visible = right && SHOW_RIGHT_CONTROLLER;
  });

  inited = true;
  logDebug?.('🚀 initXR concluído');
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  logDebug?.(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug?.('✅ loadMedia concluído');
}



function clearScene() {
  [sphereLeft, sphereRight].forEach(m => {
    if (!m) return;
    scene.remove(m); m.geometry.dispose();
    m.material.map?.dispose(); m.material.dispose();
  });
  if (videoEl) { videoEl.pause(); videoEl.src=''; videoEl.load(); videoEl.remove(); videoEl=null; }
  texLeft?.dispose?.(); texRight?.dispose?.();
  sphereLeft = sphereRight = texLeft = texRight = null;
  logDebug?.('🧹 Cena limpa');
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
    const top = INVERTER_OLHOS ? 0.5 : 0.0, bot = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.repeat.set(1,0.5);  texLeft.offset.set(0,top);
    texRight.repeat.set(1,0.5); texRight.offset.set(0,bot);
    texLeft.needsUpdate = texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0); texLeft.needsUpdate = true;
  }

  const geo = new THREE.SphereGeometry(500,60,40); geo.scale(-1,1,1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft })); scene.add(sphereLeft);
  } else {
    sphereLeft  = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));  sphereLeft.layers.set(1); scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight })); sphereRight.layers.set(2); scene.add(sphereRight);
  }

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1); xrCam.layers.enable(2);
}
