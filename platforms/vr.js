// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

const SHOW_LEFT_CONTROLLER  = true;
const SHOW_RIGHT_CONTROLLER = true;
const INVERTER_OLHOS        = true;
const SHOW_VR_DEBUG         = true;

let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;
let prevButtonPressed = false;

let prevAxesL = [0, 0];
let prevAxesR = [0, 0];
let snappedLeft = false;
let snappedRight = false;
const SNAP_THRESHOLD = 0.7; // 70%

let gripL = null, gripR = null;
let leftPresent  = false;
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

function dumpMeshes(root, label) {
  root.traverse(o => {
    if (o.isMesh) logDebug(`📦 ${label}: mesh "${o.name}"`);
  });
}

export async function initXR(externalRenderer) {
  if (inited) return;

  // cria cena e câmera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  // renderer XR
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // luz
  const spot = new THREE.SpotLight(0xffffff, 5, 10, Math.PI / 6, 0.25);
  spot.position.set(0, 2.2, 0);
  spot.target.position.set(0, 0, -1);
  camera.add(spot, spot.target);
  scene.add(camera);

  // HUD debug
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

    logDebug('version: 1.13');
    const ua = navigator.userAgent.toLowerCase();
    const device =
      ua.includes('quest pro') ? 'Meta Quest Pro' :
      ua.includes('quest 3')   ? 'Meta Quest 3'  :
      ua.includes('quest 2')   ? 'Meta Quest 2'  :
      ua.includes('quest')     ? 'Meta Quest'    :
      ua.includes('oculusbrowser') ? 'Oculus Browser' : 'Desconhecido';
    logDebug(`🎮 Dispositivo XR: ${device}`);
  }

  // controllers
  const factory = new XRControllerModelFactory();
  [0,1].forEach(i => renderer.xr.getController(i).visible = false);
  const whiteMat = model => model.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.3, metalness:0.4 });
  });

  function spawnGrip(idx,label) {
    const grip = renderer.xr.getControllerGrip(idx);
    grip.visible = false;
    const model = factory.createControllerModel(grip);
    whiteMat(model);
    grip.add(model);
    model.addEventListener('connected', () => dumpMeshes(model, `${label} ready`));
    grip.addEventListener('connected', e => {
      grip.visible = true;
      logDebug(`🟢 ${label} conectado (${e.data?.profiles?.[0]||'??'})`);
    });
    grip.addEventListener('disconnected', () => {
      grip.visible = false;
      logDebug(`🔴 ${label} desconectado`);
    });
    scene.add(grip);
    return grip;
  }
  if (SHOW_LEFT_CONTROLLER)  gripL = spawnGrip(0,'esquerdo');
  if (SHOW_RIGHT_CONTROLLER) gripR = spawnGrip(1,'direito');

  // loop XR
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // toggle HUD
    let btnNow=false;
    session.inputSources.forEach(src => {
      const gp=src.gamepad;
      if(gp&&gp.buttons[3]?.pressed) btnNow=true;
    });
    if(btnNow && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 HUD ${debugMesh.visible?'on':'off'}`);
    }
    prevButtonPressed = btnNow;

    // detect controllers
    let fL=false,fR=false;
    session.inputSources.forEach(src=>{
      if(src.handedness==='left') fL=true;
      if(src.handedness==='right') fR=true;
    });
    if(fL!==leftPresent){ logDebug(fL?'🟢 L detectado':'🔴 L sumiu'); leftPresent=fL; }
    if(fR!==rightPresent){ logDebug(fR?'🟢 R detectado':'🔴 R sumiu'); rightPresent=fR; }
    if(gripL) gripL.visible=fL;
    if(gripR) gripR.visible=fR;

    // thumbstick + snap rotate mundo
    session.inputSources.forEach(src=>{
      const gp=src.gamepad;
      if(!gp||gp.axes.length<2) return;
      const x = gp.axes.length>=4 ? gp.axes[2] : gp.axes[0];
      const y = gp.axes.length>=4 ? gp.axes[3] : gp.axes[1];
      const prev = src.handedness==='left' ? prevAxesL : prevAxesR;
      if(Math.abs(x-prev[0])>0.1||Math.abs(y-prev[1])>0.1){
        logDebug(`🎮 ${src.handedness} x=${x.toFixed(2)},y=${y.toFixed(2)}`);
        if(src.handedness==='left') prevAxesL=[x,y]; else prevAxesR=[x,y];
      }
      if(src.handedness==='left'){
        if(x>=SNAP_THRESHOLD && !snappedRight){
          scene.rotation.y -= Math.PI/2;
          snappedRight=true; snappedLeft=false;
          logDebug('➡️ Snap right');
        }
        else if(x<=-SNAP_THRESHOLD && !snappedLeft){
          scene.rotation.y += Math.PI/2;
          snappedLeft=true; snappedRight=false;
          logDebug('⬅️ Snap left');
        }
        if(x<SNAP_THRESHOLD && x>-SNAP_THRESHOLD){
          snappedLeft=snappedRight=false;
        }
      }
    });
  });

  inited = true;
  logDebug('🚀 initXR ok');
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
      texLeft.repeat.set(1, 0.5);  texLeft.offset.set(0, top);
      texRight.repeat.set(1, 0.5); texRight.offset.set(0, bot);
      texLeft.needsUpdate = texRight.needsUpdate = true;
      logDebug('🔀 Stereo configurado');
    } else {
      texLeft.repeat.set(1, 1); texLeft.offset.set(0, 0); texLeft.needsUpdate = true;
      logDebug('⚪ Mono configurado');
    }

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

    const xrCam = renderer.xr.getCamera(camera);
    xrCam.layers.enable(1);
    xrCam.layers.enable(2);
  }
