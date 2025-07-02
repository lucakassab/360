// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight, envMap;
let pmremGen;
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

  scene   = new THREE.Scene();
  camera  = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // PMREM generator para HDR "fake"
  pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();

  if (SHOW_VR_DEBUG) {
    debugCanvas  = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat  = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo  = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh  = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);
    scene.add(camera);
    const ua = navigator.userAgent.toLowerCase();
    const deviceName =
      ua.includes('quest pro') ? 'Meta Quest Pro' :
      ua.includes('quest 3')   ? 'Meta Quest 3'  :
      ua.includes('quest 2')   ? 'Meta Quest 2'  :
      ua.includes('quest')     ? 'Meta Quest'    :
      ua.includes('oculusbrowser') ? 'Oculus Browser' : 'Desconhecido';
    logDebug(`🎮 Dispositivo XR: ${deviceName}`);
  }

  const factory = new XRControllerModelFactory();

  // Esconde target-ray padrão
  [0,1].forEach(i => renderer.xr.getController(i).visible = false);

  if (SHOW_LEFT_CONTROLLER) {
    const gripL = renderer.xr.getControllerGrip(0);
    gripL.add(factory.createControllerModel(gripL));
    scene.add(gripL);
    logDebug?.('✅ Controle ESQ carregado');
  }
  if (SHOW_RIGHT_CONTROLLER) {
    const gripR = renderer.xr.getControllerGrip(1);
    gripR.add(factory.createControllerModel(gripR));
    scene.add(gripR);
    logDebug?.('✅ Controle DIR carregado');
  }

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);

    const session = renderer.xr.getSession();
    if (!session) return;

    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp || gp.buttons.length < 4) continue;

      const pressed = gp.buttons[3].pressed; // Botão B
      if (pressed && !prevButtonPressed && debugMesh) {
        debugMesh.visible = !debugMesh.visible;
        logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
      }
      prevButtonPressed = pressed;
    }
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
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  });
  if (videoEl) {
    videoEl.pause(); videoEl.src=''; videoEl.load(); videoEl.remove();
    videoEl = null;
  }
  texLeft?.dispose?.(); texRight?.dispose?.();
  if (envMap) { envMap.dispose(); envMap = null; scene.environment = null; }
  sphereLeft = sphereRight = texLeft = texRight = null;
  logDebug?.('🧹 Cena limpa');
}

async function loadMedia(media) {
  clearScene();

  // 1) Carrega textura / vídeo
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src: media.cachePath,
      crossOrigin: 'anonymous',
      loop: true, muted: true, playsInline: true
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((r,e)=>loader.load(media.cachePath, r, undefined, e));
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
  }

  // 2) Config tex
  [texLeft, texRight].forEach(t => {
    if (!t) return;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.mapping   = THREE.EquirectangularReflectionMapping;
    t.encoding  = THREE.sRGBEncoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
  });

  // 3) Stereo top-bottom
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    const bot = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.repeat.set(1,0.5);  texLeft.offset.set(0,top);
    texRight.repeat.set(1,0.5); texRight.offset.set(0,bot);
    texLeft.needsUpdate = texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0); texLeft.needsUpdate = true;
  }

  // 4) Aplica PMREM da textura (só se for imagem; vídeo deixo sem)
  if (media.type === 'image') {
    if (envMap) envMap.dispose();
    envMap = pmremGen.fromEquirectangular(texLeft).texture;
    scene.environment = envMap;
    logDebug?.('💡 Ambiente PMREM aplicado');
  }

  // 5) Esfera invertida
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1,1,1);

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
  xrCam.layers.enable(1); xrCam.layers.enable(2);
}
