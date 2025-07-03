// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// configs
const SHOW_VR_DEBUG   = true;
const INVERTER_OLHOS  = true;
const SNAP_THRESHOLD  = 0.7;
const SNAP_ANGLE      = 90;
const SNAP_RAD        = THREE.MathUtils.degToRad(SNAP_ANGLE);

let snappedLeft = false, snappedRight = false;
let prevAxesL = [0,0];
let prevButtonPressed = false;
let gripL = null, gripR = null;
let leftPresent = false, rightPresent = false;

// hud
let debugCanvas, debugTexture, debugMesh, debugLogs = [];
const MAX_LOGS = 15;
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

  // renderer XR
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // cena + pivot
  scene = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  // câmera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,0.1);
  scene.add(camera);

  // HUD debug
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 2048; debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);
    logDebug('🔧 DEBUG HUD ativo');
  }

  // controllers
  const factory = new XRControllerModelFactory();
  [0,1].forEach(i => renderer.xr.getController(i).visible = false);
  const whiteMat = model => model.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.3, metalness:0.4 });
  });
  function spawnGrip(idx, label) {
    const grip = renderer.xr.getControllerGrip(idx);
    grip.visible = false;
    const model = factory.createControllerModel(grip);
    whiteMat(model);
    grip.add(model);
    grip.addEventListener('connected', () => {
      grip.visible = true;
      logDebug(`🟢 ${label} conectado`);
    });
    grip.addEventListener('disconnected', () => {
      grip.visible = false;
      logDebug(`🔴 ${label} desconectado`);
    });
    scene.add(grip);
    return grip;
  }
  gripL = spawnGrip(0, 'Left');
  gripR = spawnGrip(1, 'Right');

  // loop XR
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // toggle HUD (botão 3)
    let btn3 = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3]?.pressed) btn3 = true;
    });
    if (btn3 && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 HUD ${debugMesh.visible?'on':'off'}`);
    }
    prevButtonPressed = btn3;

    // detecta controllers
    let L=false, R=false;
    session.inputSources.forEach(src => {
      if (src.handedness==='left')  L=true;
      if (src.handedness==='right') R=true;
    });
    if (L !== leftPresent)  logDebug(L?'🟢 Left presente':'🔴 Left ausente');
    if (R !== rightPresent) logDebug(R?'🟢 Right presente':'🔴 Right ausente');
    leftPresent = L; rightPresent = R;
    gripL.visible = L; gripR.visible = R;

    // inputSources: axes + snap
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (!gp || gp.axes.length < 2) return;

      // axes log
      const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
      const y = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
      if (Math.abs(x - prevAxesL[0]) > 0.1 || Math.abs(y - prevAxesL[1]) > 0.1) {
        logDebug(`🎯 [${src.handedness}] axes x=${x.toFixed(2)},y=${y.toFixed(2)}`);
        prevAxesL = [x, y];
      }

      // snap turn
      if (src.handedness==='left') {
        if (x >= SNAP_THRESHOLD && !snappedRight) {
          mediaGroup.rotation.y -= SNAP_RAD;
          snappedRight = true; snappedLeft = false;
          logDebug(`➡️ Snap ${SNAP_ANGLE}°`);
        } else if (x <= -SNAP_THRESHOLD && !snappedLeft) {
          mediaGroup.rotation.y += SNAP_RAD;
          snappedLeft = true; snappedRight = false;
          logDebug(`⬅️ Snap ${SNAP_ANGLE}°`);
        }
        if (x < SNAP_THRESHOLD && x > -SNAP_THRESHOLD) {
          snappedLeft = snappedRight = false;
        }
      }
    });

  });

  inited = true;
  logDebug('🚀 initXR pronto');
}

export async function load(media) {
  if (!inited) throw new Error('initXR deve rodar antes de load()');
  clearScene();
  logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug('✅ loadMedia done');
}

function clearScene() {
  mediaGroup.children.slice().forEach(obj => {
    mediaGroup.remove(obj);
    obj.geometry?.dispose();
    obj.material?.map?.dispose();
    obj.material?.dispose();
  });
  sphereLeft = sphereRight = null;
  if (videoEl) {
    videoEl.pause();
    videoEl.remove();
    videoEl = null;
  }
  texLeft?.dispose(); texRight?.dispose();
  texLeft = texRight = null;
}

async function loadMedia(media) {
  clearScene();

  // carrega vídeo ou imagem
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src: media.cachePath,
      loop: true,
      muted: true,
      playsInline: true,
      crossOrigin: 'anonymous'
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
  }

  // filtros + anisotropy
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft, texRight].forEach(t => {
    if (!t) return;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipMapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = maxA;
  });

  // split stereo / mono full
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    texLeft.repeat.set(1, 0.5);  texLeft.offset.set(0, top);
    texRight.repeat.set(1, 0.5); texRight.offset.set(0, top===0?0.5:0.0);
    texLeft.needsUpdate = true;
    texRight.needsUpdate = true;
    logDebug('🔀 Stereo split OK');
  } else {
    texLeft.repeat.set(1, 1); texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
    logDebug('⚪ Mono full OK');
  }

  // esfera 360 alta-res
  const geo = new THREE.SphereGeometry(500, 128, 128);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    sphereLeft  = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft, sphereRight);
  }

  // ativa layers no XR camera
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
