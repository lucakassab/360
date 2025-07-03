// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory }      from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRHandModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let videoEl, texLeft, texRight;
let sphereLeft, sphereRight;
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 25;
const SNAP_ANGLE_DEGREES = 20;
const SNAP_ANGLE_RADIANS = THREE.MathUtils.degToRad(SNAP_ANGLE_DEGREES);

const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG  = true;

// URL do seu servidor WebSocket de depuração
const WS_URL = 'ws://192.168.15.5:8090';
let ws;

/**
 * Log no HUD e, se aberto, no WebSocket
 */
function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;

  // mantém histórico
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();

  // desenha no canvas do HUD
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => ctx.fillText(line, 10, 30 + i * 22));
  debugTexture.needsUpdate = true;

  // envia também para o WebSocket, se conectado
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(msg);
  }
}

function dumpMeshes(root, label) {
  root.traverse(o => o.isMesh && logDebug(`📦 ${label}: mesh "${o.name}"`));
}

export async function load(media) {
  if (!renderer || !renderer.xr.enabled) {
    throw new Error('initXR(renderer) deve rodar antes de load()');
  }

  // limpa cena antiga
  mediaGroup.clear?.() ?? mediaGroup.children.slice().forEach(c=> { mediaGroup.remove(c); c.geometry.dispose(); c.material.map.dispose(); });

  logDebug(`📂 Carregando: ${media.name}`);

  // carrega vídeo ou imagem
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src:        media.cachePath,
      loop:       true,
      muted:      true,
      playsInline:true,
      crossOrigin:'anonymous'
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const tex = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(media.cachePath, res, undefined, rej)
    );
    texLeft  = tex;
    texRight = media.stereo ? tex.clone() : null;
  }

  // configura anisotopia e mapeamentos
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft, texRight].forEach(t => {
    if (!t) return;
    t.mapping        = THREE.EquirectangularReflectionMapping;
    t.encoding       = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps= true;
    t.minFilter      = THREE.LinearMipMapLinearFilter;
    t.magFilter      = THREE.LinearFilter;
    t.anisotropy     = maxA;
  });

  // define split stereo ou full mono
  if (texRight) {
    const top = INVERTER_OLHOS ? 0.5 : 0;
    texLeft.repeat.set(1, 0.5);  texLeft.offset.set(0, top); texLeft.needsUpdate = true;
    texRight.repeat.set(1,0.5); texRight.offset.set(0, top===0?0.5:0); texRight.needsUpdate = true;
    logDebug('🔀 Stereo split OK');
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0); texLeft.needsUpdate = true;
    logDebug('⚪ Mono full OK');
  }

  // monta a esfera invertida
  const geo = new THREE.SphereGeometry(500,128,128);
  geo.scale(-1,1,1);
  if (!texRight) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    sphereLeft  = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft, sphereRight);
  }

  // ativa camadas no XR camera
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);

  logDebug('✅ loadMedia concluído');
}

export async function initXR(externalRenderer) {
  // inicializa WS só uma vez
  if (!ws) {
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => console.log('🛰️ WS conectado'));
    ws.addEventListener('error', e => console.warn('🛰️ WS erro:', e));
  }

  // evita duplo init
  if (renderer && renderer.xr.enabled && scene) return;

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // cena e câmera
  scene      = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,0.1);
  scene.add(camera);

  // luz atrelada
  const light = new THREE.PointLight(0xffffff,1.5,80,2);
  light.position.set(0,0,0);
  camera.add(light);

  // HUD debug
  if (SHOW_VR_DEBUG) {
    debugCanvas  = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent:true });
    const geo2= new THREE.PlaneGeometry(0.6,0.3);
    debugMesh = new THREE.Mesh(geo2,mat);
    debugMesh.position.set(0,-0.1,-0.5);
    debugMesh.visible = false;
    camera.add(debugMesh);
    logDebug('version:1.23');
  }

  // controllers & mãos
  const controllerFactory = new XRControllerModelFactory();
  const handFactory       = new XRHandModelFactory();

  // grip controllers
  [0,1].forEach(i=>{
    const grip = renderer.xr.getControllerGrip(i);
    grip.visible = false;
    grip.userData.profile = '??';
    const model = controllerFactory.createControllerModel(grip);
    grip.add(model);

    model.addEventListener('connected', ()=> dumpMeshes(model, `controller ${i} ready`));
    grip.addEventListener('connected', e=>{
      grip.visible = true;
      const prof = e.data.profiles?.[0]||'??';
      grip.userData.profile = prof;
      logDebug(`🟢 controller ${i} conectado (${prof})`);
    });
    grip.addEventListener('disconnected', ()=>{
      const prof = grip.userData.profile;
      grip.visible = false;
      logDebug(`🔴 controller ${i} desconectado (${prof})`);
    });
    scene.add(grip);
  });

  // hand-tracking
  [0,1].forEach(i=>{
    const hand = renderer.xr.getHand(i);
    hand.visible = false;
    hand.layers.enable(1); hand.layers.enable(2);
    const mesh = handFactory.createHandModel(hand);
    hand.add(mesh);
    scene.add(hand);
  });

  // loop render
  renderer.setAnimationLoop(()=> renderer.render(scene,camera));

  // resize
  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  logDebug('🚀 initXR pronto');
}
