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
const SNAP_DEG  = 20;
const SNAP_RAD  = THREE.MathUtils.degToRad(SNAP_DEG);

const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG  = true;

// WS de debug (não bloqueia o initXR)
const WS_URL = 'ws://192.168.15.5:8090';
let ws;

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
  debugLogs.forEach((line,i)=>ctx.fillText(line,10,30+i*22));
  debugTexture.needsUpdate = true;

  if (ws?.readyState === WebSocket.OPEN) ws.send(msg);
}

function dumpMeshes(root,label){
  root.traverse(o=>o.isMesh&&logDebug(`📦 ${label}: mesh "${o.name}"`));
}

export async function load(media){
  if (!renderer?.xr.enabled) throw new Error('initXR(renderer) deve rodar antes de load()');

  // limpa cena
  mediaGroup.clear?.() ?? mediaGroup.children.slice().forEach(c=>{
    mediaGroup.remove(c);
    c.geometry?.dispose();
    c.material.map?.dispose();
  });

  logDebug(`📂 Carregando: ${media.name}`);

  // cria video ou textura
  if (media.type==='video'){
    videoEl = document.createElement('video');
    Object.assign(videoEl,{
      src:        media.cachePath,
      loop:       true,
      muted:      true,
      playsInline:true,
      crossOrigin:'anonymous'
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo? new THREE.VideoTexture(videoEl): null;
  } else {
    const tex = await new Promise((res,rej)=>
      new THREE.TextureLoader().load(media.cachePath,res,undefined,rej)
    );
    texLeft  = tex;
    texRight = media.stereo? tex.clone(): null;
  }

  // configura textura
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft,texRight].forEach(t=>{
    if (!t) return;
    t.mapping         = THREE.EquirectangularReflectionMapping;
    t.encoding        = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter       = THREE.LinearMipMapLinearFilter;
    t.magFilter       = THREE.LinearFilter;
    t.anisotropy      = maxA;
  });

  // split stereo / mono
  if (texRight){
    const top = INVERTER_OLHOS?0.5:0;
    texLeft.repeat.set(1,0.5);  texLeft.offset.set(0,top);  texLeft.needsUpdate=true;
    texRight.repeat.set(1,0.5); texRight.offset.set(0,top===0?0.5:0); texRight.needsUpdate=true;
    logDebug('🔀 Stereo split OK');
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0); texLeft.needsUpdate=true;
    logDebug('⚪ Mono full OK');
  }

  // monta esfera invertida
  const geo = new THREE.SphereGeometry(500,128,128);
  geo.scale(-1,1,1);
  if (!texRight){
    sphereLeft = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    sphereLeft  = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texLeft }));
    sphereRight = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({ map:texRight }));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft,sphereRight);
  }

  // ativa camadas na camera normal e XRCamera
  camera.layers.enable(1);
  camera.layers.enable(2);
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);

  logDebug('✅ loadMedia concluído');
}

export async function initXR(externalRenderer){
  // inicializa WS sem bloquear
  if (!ws){
    ws = new WebSocket(WS_URL);
    ws.onopen  = ()=>logDebug('🛰️ WS conectado');
    ws.onerror = e=>logDebug('🛰️ WS erro:'+e.message);
  }

  if (renderer?.xr.enabled && scene) return;

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio*2);
  renderer.xr.enabled               = true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping              = THREE.NoToneMapping;
  renderer.outputEncoding           = THREE.sRGBEncoding;

  // cena e câmera
  scene      = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
  camera.position.set(0,0,0.1);
  camera.layers.enable(1);
  camera.layers.enable(2);
  scene.add(camera);

  // luz
  const light = new THREE.PointLight(0xffffff,1.5,80,2);
  light.position.set(0,0,0);
  camera.add(light);

  // HUD debug
  if (SHOW_VR_DEBUG){
    debugCanvas  = document.createElement('canvas');
    debugCanvas.width  = 2048;
    debugCanvas.height = 1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat2 = new THREE.MeshBasicMaterial({ map:debugTexture, transparent:true });
    const geo2 = new THREE.PlaneGeometry(0.6,0.3);
    debugMesh = new THREE.Mesh(geo2,mat2);
    debugMesh.position.set(0,-0.1,-0.5);
    debugMesh.visible = false;
    camera.add(debugMesh);
    logDebug('version:1.23');
  }

  // controllers & mãos
  const cf = new XRControllerModelFactory();
  const hf = new XRHandModelFactory();

  // grips
  [0,1].forEach(i=>{
    const grip = renderer.xr.getControllerGrip(i);
    grip.visible = false;
    grip.userData.profile = '??';
    const model = cf.createControllerModel(grip);
    grip.add(model);
    model.addEventListener('connected',()=>dumpMeshes(model,`controller ${i} ready`));
    grip.addEventListener('connected',e=>{
      grip.visible = true;
      const p = e.data.profiles?.[0]||'??';
      grip.userData.profile = p;
      logDebug(`🟢 controller ${i} conectado (${p})`);
    });
    grip.addEventListener('disconnected',()=>{
      grip.visible = false;
      logDebug(`🔴 controller ${i} desconectado (${grip.userData.profile})`);
    });
    scene.add(grip);
  });

  // mãos
  [0,1].forEach(i=>{
    const hand = renderer.xr.getHand(i);
    hand.visible = false;
    hand.layers.enable(1); hand.layers.enable(2);
    const mesh = hf.createHandModel(hand);
    hand.add(mesh);
    scene.add(hand);
  });

  // render loop
  renderer.setAnimationLoop(()=> renderer.render(scene,camera));

  // resize
  window.addEventListener('resize',()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  logDebug('🚀 initXR pronto');
}
