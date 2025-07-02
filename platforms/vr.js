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
let leftPresent  = false;   // estados para detectar mudança
let rightPresent = false;

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

// helper p/ listar meshes
function dumpMeshes(root, label) {
  root.traverse(o => {
    if (o.isMesh) logDebug(`📦 ${label}: mesh "${o.name}"`);
  });
}

export async function initXR(externalRenderer) {
  if (inited) return;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // SpotLight
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI / 6, 0.25);
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
  [0, 1].forEach(i => renderer.xr.getController(i).visible = false); // esconde target-ray

  const whiteMat = model => {
    model.traverse(o => {
      if (o.isMesh) o.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.4
      });
    });
  };

  if (SHOW_LEFT_CONTROLLER) {
    gripL = renderer.xr.getControllerGrip(0);
    const mL = factory.createControllerModel(gripL);
    whiteMat(mL);
    dumpMeshes(mL, 'L');            // log de meshes
    gripL.add(mL);
    scene.add(gripL);
    gripL.visible = false;
  }

  if (SHOW_RIGHT_CONTROLLER) {
    gripR = renderer.xr.getControllerGrip(1);
    const mR = factory.createControllerModel(gripR);
    whiteMat(mR);
    dumpMeshes(mR, 'R');
    gripR.add(mR);
    scene.add(gripR);
    gripR.visible = false;
  }

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);

    const session = renderer.xr.getSession();
    if (!session) return;

    // 1) Toggle HUD com botão B
    let btnPressedNow = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3]?.pressed) btnPressedNow = true;
    });
    if (btnPressedNow && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
    }
    prevButtonPressed = btnPressedNow;

    // 2) Autodetecção de controles + log
    let foundLeft = false, foundRight = false;
    session.inputSources.forEach(src => {
      if (src.handedness === 'left')  foundLeft  = true;
      if (src.handedness === 'right') foundRight = true;
    });

    if (foundLeft !== leftPresent) {
      logDebug(foundLeft ? '🟢 controle esquerdo detectado' : '🔴 controle esquerdo perdido');
      leftPresent = foundLeft;
    }
    if (foundRight !== rightPresent) {
      logDebug(foundRight ? '🟢 controle direito detectado' : '🔴 controle direito perdido');
      rightPresent = foundRight;
    }

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
  texLeft?.dispose?.(); texRight?.dispose?.();
  sphereLeft = sphereRight = texLeft = texRight = null;
  logDebug('🧹 Cena limpa');
}

async function loadMedia(media) {
  clearScene();

  // 1) Textura
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
    logDebug('🎥 VideoTexture criada');
  } else {
    const loader = new THREE.TextureLoader();
    const base   = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
    logDebug('📷 TextureLoader carregou imagem');
  }

  // 2) Configura texturas
  [texLeft, texRight].forEach(t => {
    if (!t) return;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
  });

  // 3) Stereo top-bottom
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    const bot = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.repeat.set(1, 0.5);  texLeft.offset.set(0, top);
    texRight.repeat.set(1, 0.5); texRight.offset.set(0, bot);
    texLeft.needsUpdate = texRight.needsUpdate = true;
    logDebug('🔀 Stereo configurado');
  } else {
    texLeft.repeat.set(1, 1); texLeft.offset.set(0, 0); texLeft.needsUpdate = true;
    logDebug('⚪ Mono configurado');
  }

  // 4) Esfera
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    dumpMeshes(sphereLeft, 'SphereMono');
  } else {
    sphereLeft  = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.set(1); scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereRight.layers.set(2); scene.add(sphereRight);
    dumpMeshes(sphereLeft,  'SphereL');
    dumpMeshes(sphereRight, 'SphereR');
  }

  // 5) Habilita layers na câmera
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
