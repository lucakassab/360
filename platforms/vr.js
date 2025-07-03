// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight, videoEl, texLeft, texRight;
let inited = false;

const SHOW_LEFT_CONTROLLER  = true;
const SHOW_RIGHT_CONTROLLER = true;
const INVERTER_OLHOS        = true;
const SHOW_VR_DEBUG         = true;

let debugCanvas, debugTexture, debugMesh;
let debugLogs = [], prevButtonPressed = false;
const MAX_LOGS = 10;

let gripL = null, gripR = null;
let leftPresent = false, rightPresent = false;

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
  debugLogs.forEach((l, i) => ctx.fillText(l, 10, 30 + i * 22));
  debugTexture.needsUpdate = true;
}

function dumpMeshes(root, label) {
  console.group(`MeshDump: ${label}`);
  let count = 0;
  root.traverse(o => {
    if (o.isMesh) {
      console.log(`📦 ${label}: mesh "${o.name}"`, o);
      if (SHOW_VR_DEBUG) logDebug(`📦 ${label}: mesh "${o.name}"`);
      count++;
    }
  });
  console.log(`Total meshes: ${count}`);
  console.groupEnd();
}

export async function initXR(extRenderer) {
  if (inited) return;

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);
  scene.add(camera);

  // Renderer
  renderer = extRenderer;
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI / 6, 0.25);
  spot.position.set(0, 2.2, 0);
  spot.target.position.set(0, 0, -1);
  camera.add(spot, spot.target);

  // HUD
  if (SHOW_VR_DEBUG) {
    debugCanvas = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 });
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    debugMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.3),
      new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true })
    );
    debugMesh.position.set(0, -0.1, -0.5);
    debugMesh.visible = false;
    camera.add(debugMesh);

    const ua = navigator.userAgent.toLowerCase();
    const dev =
      ua.includes('quest pro') ? 'Meta Quest Pro' :
      ua.includes('quest 3')   ? 'Meta Quest 3'  :
      ua.includes('quest 2')   ? 'Meta Quest 2'  :
      ua.includes('quest')     ? 'Meta Quest'    :
      ua.includes('oculusbrowser') ? 'Oculus Browser' : 'Desconhecido';
    logDebug(`🎮 Dispositivo XR: ${dev}`);
  }

  // Initial dump of all scene meshes
  dumpMeshes(scene, 'initial scene');

  // Controller factory & hide default ray
  const factory = new XRControllerModelFactory();
  [0, 1].forEach(i => {
    const c = renderer.xr.getController(i);
    if (c) c.visible = false;
  });

  const whiteMat = model => model.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.4
    });
  });

  function spawnGrip(index, label) {
    const grip = renderer.xr.getControllerGrip(index);
    grip.visible = false;
    let model = null;

    grip.addEventListener('connected', e => {
      const prof = (e.data?.profiles?.[0] || '').toLowerCase();
      console.log(`Controller ${label} connected with profiles:`, e.data.profiles);
      if (prof.includes('hand')) {
        console.debug(`🙌 ${label} hand-tracking ignored`);
        return;
      }
      if (!model) {
        model = factory.createControllerModel(grip);
        whiteMat(model);
        grip.add(model);
        console.log(`🔧 ${label} model added`);
        dumpMeshes(model, `${label} model`);
      }
      grip.visible = true;
      logDebug(`🟢 ${label} detectado (${prof})`);
    });

    grip.addEventListener('disconnected', () => {
      grip.visible = false;
      console.log(`❌ ${label} disconnected`);
      logDebug(`🔴 ${label} perdido`);
    });

    scene.add(grip);
    return grip;
  }

  if (SHOW_LEFT_CONTROLLER)  gripL = spawnGrip(0, 'controle esquerdo');
  if (SHOW_RIGHT_CONTROLLER) gripR = spawnGrip(1, 'controle direito');

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    if (SHOW_VR_DEBUG && debugMesh.visible) debugTexture.needsUpdate = true;

    const sess = renderer.xr.getSession();
    if (!sess) return;

    // Toggle HUD
    const press = sess.inputSources.some(src => src.gamepad?.buttons[3]?.pressed);
    if (press && !prevButtonPressed) {
      debugMesh.visible = !debugMesh.visible;
      console.log(`HUD ${debugMesh.visible ? 'ON' : 'OFF'}`);
      logDebug(`🟢 Debug HUD ${debugMesh.visible ? 'ativado' : 'desativado'}`);
    }
    prevButtonPressed = press;

    // Fallback visibility (skip hand-tracking)
    let fL = false, fR = false;
    sess.inputSources.forEach(src => {
      if (src.hand) return;
      if (src.handedness === 'left')  fL = true;
      if (src.handedness === 'right') fR = true;
    });
    if (fL !== leftPresent) {
      console.log(`${fL ? '✅' : '❌'} leftPresent = ${fL}`);
      logDebug(fL ? '🟢 controle esquerdo detectado' : '🔴 controle esquerdo perdido');
      leftPresent = fL;
    }
    if (fR !== rightPresent) {
      console.log(`${fR ? '✅' : '❌'} rightPresent = ${fR}`);
      logDebug(fR ? '🟢 controle direito detectado' : '🔴 controle direito perdido');
      rightPresent = fR;
    }
    if (gripL) gripL.visible = leftPresent;
    if (gripR) gripR.visible = rightPresent;
  });

  inited = true;
  console.log('🚀 initXR concluído');
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
    Object.assign(videoEl, {
      src: media.cachePath,
      crossOrigin: 'anonymous',
      loop: true,
      muted: true,
      playsInline: true
    });
    await videoEl.play();
    texLeft = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
    logDebug('🎥 VideoTexture criada');
  } else {
    const base = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(media.cachePath, res, undefined, rej)
    );
    texLeft = base;
    texRight = media.stereo ? base.clone() : null;
    logDebug('📷 TextureLoader carregou imagem');
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
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    const bot = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.repeat.set(1, 0.5);
    texLeft.offset.set(0, top);
    texRight.repeat.set(1, 0.5);
    texRight.offset.set(0, bot);
    logDebug('🔀 Stereo configurado');
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    logDebug('⚪ Mono configurado');
  }

  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    dumpMeshes(sphereLeft, 'SphereMono');
  } else {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.set(1);
    scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereRight.layers.set(2);
    scene.add(sphereRight);
    dumpMeshes(sphereLeft, 'SphereL');
    dumpMeshes(sphereRight, 'SphereR');
  }

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
