// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// Configs
const SHOW_VR_DEBUG = true;
const INVERTER_OLHOS = true;
const SNAP_THRESHOLD = 0.7;
const SNAP_ANGLE_DEGREES = 20;
const SNAP_ANGLE_RADIANS = THREE.MathUtils.degToRad(SNAP_ANGLE_DEGREES);

// HUD state
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 15;
let hudVisible = false;

// Input state
const prevButtonState = { left: [], right: [] };
let prevAxes = { left: [0,0], right: [0,0] };
let snapped = { left: false, right: false };

function logDebug(msg) {
  if (!SHOW_VR_DEBUG || !hudVisible) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0'; ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => ctx.fillText(line, 10, 30 + i*22));
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  mediaGroup = new THREE.Group(); scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,0.1); scene.add(camera);

  // Point light above camera
  const pointLight = new THREE.PointLight(0xffffff, 1.5, 40, 2);
  pointLight.position.set(0,1,0); camera.add(pointLight);

  // HUD setup (hidden by default)
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 2048; debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    debugMesh.visible = false;
    camera.add(debugMesh);
  }

  const factory = new XRControllerModelFactory();
  [0,1].forEach(i => renderer.xr.getController(i).visible = false);
  const whiteMat = model => model.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.3, metalness:0.4 }); });

  function spawnGrip(idx, hand) {
    const grip = renderer.xr.getControllerGrip(idx);
    grip.visible = false;
    const model = factory.createControllerModel(grip);
    whiteMat(model); grip.add(model);
    model.addEventListener('connected', () => logDebug(`📦 ${hand} model ready`));
    grip.addEventListener('connected', (e) => { grip.visible = true; logDebug(`🟢 ${hand} connected`); });
    grip.addEventListener('disconnected', () => { grip.visible = false; logDebug(`🔴 ${hand} disconnected`); });
    scene.add(grip); return grip;
  }
  gripL = spawnGrip(0,'Left');
  gripR = spawnGrip(1,'Right');

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession(); if (!session) return;

    // Toggle HUD with button 3 on any controller
    let toggle = false;
    session.inputSources.forEach(src => { if (src.gamepad && src.gamepad.buttons[3]?.pressed) toggle = true; });
    if (toggle && !prevButtonPressed) {
      hudVisible = !hudVisible;
      debugMesh.visible = hudVisible;
      logDebug(`🟢 HUD ${hudVisible?'on':'off'}`);
    }
    prevButtonPressed = toggle;

    // Log button presses and snap turn for both controllers
    session.inputSources.forEach(src => {
      const gp = src.gamepad; if (!gp) return;
      const hand = src.handedness;
      // Buttons
      gp.buttons.forEach((btn, idx) => {
        const prev = prevButtonState[hand][idx] || false;
        if (btn.pressed && !prev) logDebug(`🎮 [${hand}] button[${idx}] pressed`);
        if (!btn.pressed && prev) logDebug(`❌ [${hand}] button[${idx}] released`);
        prevButtonState[hand][idx] = btn.pressed;
      });
      // Axes + snap turn both hands
      if (gp.axes.length>=2) {
        const x = gp.axes.length>=4?gp.axes[2]:gp.axes[0];
        const y = gp.axes.length>=4?gp.axes[3]:gp.axes[1];
        const prevA = prevAxes[hand];
        if (Math.abs(x-prevA[0])>0.1||Math.abs(y-prevA[1])>0.1) {
          logDebug(`🎯 [${hand}] axes x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
          prevAxes[hand] = [x,y];
        }
        if (x>=SNAP_THRESHOLD && !snapped[hand]) {
          mediaGroup.rotation.y += SNAP_ANGLE_RADIANS;
          snapped[hand] = true;
          logDebug(`➡️ [${hand}] Snap ${SNAP_ANGLE_DEGREES}°`);
        } else if (x<=-SNAP_THRESHOLD && !snapped[hand]) {
          mediaGroup.rotation.y -= SNAP_ANGLE_RADIANS;
          snapped[hand] = true;
          logDebug(`⬅️ [${hand}] Snap -${SNAP_ANGLE_DEGREES}°`);
        }
        if (x < SNAP_THRESHOLD && x > -SNAP_THRESHOLD) snapped[hand] = false;
      }
    });
  });

  inited = true;
  logDebug('🚀 initXR ready');
}

// Async media loading
function loadMedia(media) {
  if (videoEl) { videoEl.pause(); videoEl.remove(); }
  if (media.type==='video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, { src: media.cachePath, loop:true, muted:true, playsInline:true, crossOrigin:'anonymous' });
    videoEl.play();
    texLeft = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
    setupTexture(); applyTexture();
  } else {
    new THREE.TextureLoader().load(media.cachePath, tex => {
      texLeft = tex; texRight = media.stereo?tex.clone():null;
      setupTexture(); applyTexture();
    });
  }
}

function setupTexture() {
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft, texRight].forEach(t=>{
    if (!t) return;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipMapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = maxA;
  });
}

function applyTexture() {
  clearScene();
  const geo = new THREE.SphereGeometry(500,128,128); geo.scale(-1,1,1);
  if (!texRight) {
    sphereLeft = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft}));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    const top = INVERTER_OLHOS?0.5:0.0;
    texLeft.repeat.set(1,0.5); texLeft.offset.set(0,top); texLeft.needsUpdate=true;
    texRight.repeat.set(1,0.5); texRight.offset.set(0,top===0?0.5:0); texRight.needsUpdate=true;
    sphereLeft = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft}));
    sphereRight= new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texRight}));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft,sphereRight);
  }
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1); xrCam.layers.enable(2);
}

function clearScene() {
  mediaGroup.children.slice().forEach(c=>{ mediaGroup.remove(c); c.geometry.dispose(); c.material.map.dispose(); });
}
