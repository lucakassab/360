// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from '../libs/XRControllerModelFactory.js';
import { XRHandModelFactory }      from '../libs/XRHandModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let videoEl, texLeft, texRight;
let sphereLeft, sphereRight;
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 20;
const SNAP_DEGREES = 20;
const SNAP_RAD     = THREE.MathUtils.degToRad(SNAP_DEGREES);

const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG  = true;

window._vrLogDump = window._vrLogDump || [];

function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  const timestamp = (new Date()).toISOString().slice(11,23);
  const entry = `[${timestamp}] ${msg}`;
  debugLogs.push(entry);
  window._vrLogDump.push(entry);
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

window.baixarVRLog = function() {
  const txt = window._vrLogDump.join('\n');
  const blob = new Blob([txt], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'log_vr.txt';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
};

const BUTTON_NAMES = {
  "right-controller": {
    0: "Trigger",
    1: "Grip",
    3: "Thumbstick",
    4: "A",
    5: "B"
  },
  "left-controller": {
    0: "Trigger",
    1: "Grip",
    3: "Thumbstick",
    4: "X",
    5: "Y",
    12: "Menu"
  },
  "left-hand": {
    0: "IndexPinch",
    4: "Wrist/Menu"
  },
  "right-hand": {
    0: "IndexPinch"
  }
};

export function debugLog(hand, idxOrMsg) {
  let label = idxOrMsg;
  if (typeof idxOrMsg === "string" && idxOrMsg.startsWith("button")) {
    const idx = idxOrMsg.replace("button", "");
    const pretty = BUTTON_NAMES[hand]?.[idx];
    if (pretty) label = `button${idx} (${pretty})`;
  }
  logDebug(`[${hand}] ${label}`);
}

function dumpMeshes(root, label) {
  root.traverse(o => o.isMesh && logDebug(`📦 ${label}: mesh "${o.name}"`));
}

export async function load(media) {
  if (!renderer || !renderer.xr.enabled) {
    throw new Error('initXR(renderer) deve rodar antes de load()');
  }
  mediaGroup.children.slice().forEach(c => {
    mediaGroup.remove(c);
    c.geometry?.dispose?.();
    c.material?.map?.dispose?.();
    c.material?.dispose?.();
  });
  logDebug(`📂 Carregando: ${media.name}`);

  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src: media.cachePath, loop: true, muted: true,
      playsInline: true, crossOrigin:'anonymous'
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

  if (texRight) {
    const top = INVERTER_OLHOS ? 0.5 : 0;
    texLeft.repeat.set(1,0.5); texLeft.offset.set(0,top);   texLeft.needsUpdate = true;
    texRight.repeat.set(1,0.5);texRight.offset.set(0,top===0?0.5:0);texRight.needsUpdate = true;
    logDebug('🔀 Stereo split OK');
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0); texLeft.needsUpdate = true;
    logDebug('⚪ Mono full OK');
  }

  const geo = new THREE.SphereGeometry(500,128,128);
  geo.scale(-1,1,1);
  if (!texRight) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    sphereLeft  = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereRight = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texRight }));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft, sphereRight);
  }

  camera.layers.enable(1); camera.layers.enable(2);
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1); xrCam.layers.enable(2);

  logDebug('✅ loadMedia concluído');
}

export async function initXR(externalRenderer) {
  if (renderer && renderer.xr.enabled && scene) return;
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio*2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene      = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
  camera.position.set(0,0,0.1);
  camera.layers.enable(1);
  camera.layers.enable(2);
  scene.add(camera);

  const light = new THREE.PointLight(0xffffff,1.5,80,2);
  light.position.set(0,0,0);
  camera.add(light);

  if (SHOW_VR_DEBUG) {
    debugCanvas  = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat  = new THREE.MeshBasicMaterial({ map:debugTexture, transparent:true });
    const geo2 = new THREE.PlaneGeometry(0.6,0.3);
    debugMesh  = new THREE.Mesh(geo2, mat);
    debugMesh.position.set(0,-0.1,-0.5);
    debugMesh.visible = true;
    camera.add(debugMesh);

    if (!document.getElementById('btnBaixarLogVR')) {
      const btn = document.createElement('button');
      btn.id = 'btnBaixarLogVR';
      btn.innerText = '⏬ Baixar Log VR';
      btn.style.cssText = `
        position:fixed;top:8px;right:8px;z-index:9999;
        padding:7px 18px;background:#111;color:#0f0;font:700 16px monospace;
        border-radius:10px;border:none;cursor:pointer;opacity:0.93;
      `;
      btn.onclick = window.baixarVRLog;
      document.body.appendChild(btn);
    }

    logDebug('version:1.23');
    logDebug('🟢 Log TXT ativado: clique em "⏬ Baixar Log VR"!');
  }

  const cf = new XRControllerModelFactory();
  const hf = new XRHandModelFactory();

  [0,1].forEach(i=>{
    const grip = renderer.xr.getControllerGrip(i);
    grip.visible = false;
    grip.userData.profile = '??';
    const model = cf.createControllerModel(grip);
    grip.add(model);
    model.addEventListener('connected', ()=> dumpMeshes(model, `controller ${i} ready`));
    grip.addEventListener('connected', e=>{
      grip.visible = true;
      const p = e.data.profiles?.[0]||'??';
      grip.userData.profile = p;
      logDebug(`🟢 controller ${i} conectado (${p})`);
    });
    grip.addEventListener('disconnected', ()=>{
      grip.visible = false;
      logDebug(`🔴 controller ${i} desconectado (${grip.userData.profile})`);
    });
    scene.add(grip);
  });

  [0,1].forEach(i=>{
    const hand = renderer.xr.getHand(i);
    hand.visible = false;
    hand.layers.enable(1); hand.layers.enable(2);
    const mesh = hf.createHandModel(hand);
    hand.add(mesh);
    scene.add(hand);
  });

  // PATCH AQUI: Força evento 'connected' nos grips, caso inputSource já exista
  const session = renderer.xr.getSession && renderer.xr.getSession();
  if (session) {
    session.inputSources.forEach((src) => {
      if (src.targetRayMode === 'tracked-pointer' && !src.hand && src.gamepad) {
        [0, 1].forEach(i => {
          const grip = renderer.xr.getControllerGrip(i);
          if (grip && grip.dispatchEvent) {
            grip.dispatchEvent({ type: 'connected', data: src });
          }
        });
      }
    });
  }
  // ---- FIM DO PATCH ----

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  logDebug('🚀 initXR pronto');
}

export function _toggleDebug() {
  if (debugMesh) debugMesh.visible = !debugMesh.visible;
}

export function snapTurn(hand, dir) {
  mediaGroup.rotation.y += dir * SNAP_RAD;
  logDebug(`${hand} snap ${dir>0?'▶':'◀'}`);
}
