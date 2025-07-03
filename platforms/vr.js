// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

const SHOW_LEFT_CONTROLLER  = true;
const SHOW_RIGHT_CONTROLLER = true;
const INVERTER_OLHOS        = true;
const SHOW_VR_DEBUG         = true;

// --- CONFIGURAÇÃO DE SNAP TURN ---
const SNAP_THRESHOLD = 0.7;    // 0.0–1.0 sensibilidade do stick
const SNAP_ANGLE     = 90;     // ângulo em graus, muda aqui
const SNAP_RAD       = THREE.MathUtils.degToRad(SNAP_ANGLE);
// -----------------------------------

let snappedLeft  = false;
let snappedRight = false;

let prevButtonPressed = false;
let gripL = null, gripR = null;
let leftPresent = false, rightPresent = false;

let debugCanvas, debugTexture, debugMesh, debugLogs = [];
const MAX_LOGS = 10;

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

  // renderer XR já criado em core.js
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // cena, pivot 360 e câmera
  scene      = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);
  scene.add(camera);

  // luz simples
  const spot = new THREE.SpotLight(0xffffff,5,10,Math.PI/6,0.25);
  spot.position.set(0,2.2,0);
  spot.target.position.set(0,0,-1);
  camera.add(spot, spot.target);

  // HUD debug
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);

    logDebug('version: 1.15');
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
  gripL = spawnGrip(0,'esquerdo');
  gripR = spawnGrip(1,'direito');

  // loop XR
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if (!session) return;

    // toggle debug HUD = botão 3
    let btn = false;
    session.inputSources.forEach(src => {
      const gp = src.gamepad;
      if (gp && gp.buttons[3]?.pressed) btn = true;
    });
    if (btn && !prevButtonPressed && debugMesh) {
      debugMesh.visible = !debugMesh.visible;
      logDebug(`🟢 HUD ${debugMesh.visible?'on':'off'}`);
    }
    prevButtonPressed = btn;

    // detecta controllers
    let L=false, R=false;
    session.inputSources.forEach(src=>{
      if(src.handedness==='left')  L=true;
      if(src.handedness==='right') R=true;
    });
    if(L!==leftPresent)  { logDebug(L?'🟢 L detectado':'🔴 L sumiu'); leftPresent=L; }
    if(R!==rightPresent) { logDebug(R?'🟢 R detectado':'🔴 R sumiu'); rightPresent=R; }
    gripL.visible = leftPresent;
    gripR.visible = rightPresent;

    // thumbstick + snap turn configurável
    session.inputSources.forEach(src=>{
      const gp = src.gamepad;
      if(!gp||gp.axes.length<2) return;
      const x = gp.axes.length>=4 ? gp.axes[2] : gp.axes[0];
      if(src.handedness==='left'){
        if(x>=SNAP_THRESHOLD && !snappedRight){
          mediaGroup.rotation.y -= SNAP_RAD;
          snappedRight=true; snappedLeft=false;
          logDebug(`➡️ Snap ${SNAP_ANGLE}°`);
        }
        else if(x<=-SNAP_THRESHOLD && !snappedLeft){
          mediaGroup.rotation.y += SNAP_RAD;
          snappedLeft=true; snappedRight=false;
          logDebug(`⬅️ Snap ${SNAP_ANGLE}°`);
        }
        if(x<SNAP_THRESHOLD && x>-SNAP_THRESHOLD){
          snappedLeft=snappedRight=false;
        }
      }
    });
  });

  inited = true;
  logDebug('🚀 initXR pronto');
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  clearScene();
  logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug('✅ loadMedia ok');
}

function clearScene() {
  mediaGroup.children.slice().forEach(obj=>{
    mediaGroup.remove(obj);
    obj.geometry?.dispose();
    obj.material?.map?.dispose();
    obj.material?.dispose();
  });
  sphereLeft=sphereRight=null;
  if(videoEl){ videoEl.pause(); videoEl.src=''; videoEl.load(); videoEl.remove(); videoEl=null; }
  texLeft?.dispose(); texRight?.dispose();
  texLeft=texRight=null;
}

async function loadMedia(media) {
  // carrega vídeo ou imagem
  if(media.type==='video'){
    videoEl=document.createElement('video');
    Object.assign(videoEl,{ src:media.cachePath, loop:true, muted:true, playsInline:true, crossOrigin:'anonymous' });
    await videoEl.play();
    texLeft = new THREE.VideoTexture(videoEl);
    texRight= media.stereo? new THREE.VideoTexture(videoEl): null;
  } else {
    const base = await new Promise((res,rej)=> new THREE.TextureLoader().load(media.cachePath,res,undefined,rej));
    texLeft = base;
    texRight= media.stereo? base.clone() : null;
  }

  // filtros top
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft,texRight].forEach(t=>{
    if(!t) return;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding= THREE.sRGBEncoding;
    t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    t.generateMipmaps=true;
    t.minFilter=THREE.LinearMipMapLinearFilter;
    t.magFilter=THREE.LinearFilter;
    t.anisotropy=maxA;
  });

  // stereo split
  if(media.stereo){
    const top= INVERTER_OLHOS?0.5:0.0;
    texLeft.repeat.set(1,0.5);  texLeft.offset.set(0,top);
    texRight.repeat.set(1,0.5); texRight.offset.set(0, top===0?0.5:0.0);
    logDebug('🔀 Stereo split OK');
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0);
    logDebug('⚪ Mono full OK');
  }

  // esfera 360 de altíssima resolução
  const geo = new THREE.SphereGeometry(500,128,128);
  geo.scale(-1,1,1);

  if(!media.stereo){
    sphereLeft = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
    dumpMeshes(sphereLeft,'Mono');
  } else {
    sphereLeft  = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereRight = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texRight }));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft,sphereRight);
    dumpMeshes(sphereLeft,'L'); dumpMeshes(sphereRight,'R');
  }
}
