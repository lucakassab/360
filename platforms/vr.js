// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';
import { setupVRInputs } from './vr_inputs.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG = true;

let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;

const SNAP_ANGLE_DEGREES = 20;
const SNAP_ANGLE_RADIANS = THREE.MathUtils.degToRad(SNAP_ANGLE_DEGREES);

// log e debug
function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,debugCanvas.width,debugCanvas.height);
  ctx.fillStyle = '#0f0'; ctx.font = '20px monospace';
  debugLogs.forEach((line,i)=>ctx.fillText(line,10,30+i*22));
  debugTexture.needsUpdate = true;
}
function dumpMeshes(root,label) {
  root.traverse(o=>o.isMesh&&logDebug(`📦 ${label}: mesh "${o.name}"`));
}

// load público, retorna promise para core.js
export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  clearScene();
  logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug('✅ loadMedia concluído');
}

// inicializa XR e input handlers
export async function initXR(externalRenderer) {
  if (inited) return;
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio*2);
  renderer.xr.enabled=true;
  renderer.xr.setFramebufferScaleFactor(1.0);
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.outputEncoding=THREE.sRGBEncoding;

  scene=new THREE.Scene(); mediaGroup=new THREE.Group(); scene.add(mediaGroup);
  camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
  camera.position.set(0,0,0.1); scene.add(camera);

  const light=new THREE.PointLight(0xffffff,1.5,80,2);
  light.position.set(0,0,0); camera.add(light);

  if(SHOW_VR_DEBUG) {
    debugCanvas=document.createElement('canvas'); debugCanvas.width=2048; debugCanvas.height=1024;
    debugTexture=new THREE.CanvasTexture(debugCanvas);
    const mat=new THREE.MeshBasicMaterial({map:debugTexture,transparent:true});
    const geo=new THREE.PlaneGeometry(0.6,0.3);
    debugMesh=new THREE.Mesh(geo,mat);
    debugMesh.position.set(0,-0.1,-0.5);
    debugMesh.visible=false;
    camera.add(debugMesh);
    logDebug('version:1.21');
  }

  const factory=new XRControllerModelFactory();
  [0,1].forEach(i=>renderer.xr.getController(i).visible=false);
  const whiteMat=model=>model.traverse(o=>o.isMesh&&(o.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.4})));

  function spawnGrip(idx,label) {
    const g=renderer.xr.getControllerGrip(idx);
    g.visible=false;
    const m=factory.createControllerModel(g);
    whiteMat(m); g.add(m);
    m.addEventListener('connected',()=>dumpMeshes(m,`${label} ready`));
    g.addEventListener('connected',e=>{ g.visible=true; logDebug(`🟢 ${label} conectado (${e.data?.profiles?.[0]||'??'})`); });
    g.addEventListener('disconnected',()=>{ g.visible=false; logDebug(`🔴 ${label} desconectado`); });
    scene.add(g); return g;
  }
  const gripL=spawnGrip(0,'Left');
  const gripR=spawnGrip(1,'Right');

  setupVRInputs(renderer,{
    onNext:()=>window.nextMedia&&window.nextMedia(),
    onPrev:()=>window.prevMedia&&window.prevMedia(),
    onToggleHUD:()=>debugMesh.visible=!debugMesh.visible,
    onSnap:(hand,dir)=>{
      mediaGroup.rotation.y += dir*SNAP_ANGLE_RADIANS;
      logDebug(dir>0?'➡️ Snap R':'⬅️ Snap L');
    },
    onDebugLog:(hand,idx)=>logDebug(`[${hand}] button[${idx}] pressed`)
  });

  renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  inited=true;
  logDebug('🚀 initXR pronto');
}

// retorna Promise
async function loadMedia(media) {
  if(videoEl){ videoEl.pause(); videoEl.remove(); }
  if(media.type==='video'){
    videoEl=document.createElement('video');
    Object.assign(videoEl,{src:media.cachePath,loop:true,muted:true,playsInline:true,crossOrigin:'anonymous'});
    await videoEl.play();
    texLeft=new THREE.VideoTexture(videoEl);
    texRight=media.stereo?new THREE.VideoTexture(videoEl):null;
  } else {
    const tex=await new Promise((res,rej)=>
      new THREE.TextureLoader().load(media.cachePath,res,undefined,rej)
    );
    texLeft=tex;
    texRight=media.stereo?tex.clone():null;
  }
  setupTexture();
  applyTexture();
}

function setupTexture(){
  const ma=renderer.capabilities.getMaxAnisotropy();
  [texLeft,texRight].forEach(t=>{if(!t)return; t.mapping=THREE.EquirectangularReflectionMapping; t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.generateMipmaps=true; t.minFilter=THREE.LinearMipMapLinearFilter; t.magFilter=THREE.LinearFilter; t.anisotropy=ma;});
}

function applyTexture(){
  clearScene(); const geo=new THREE.SphereGeometry(500,128,128); geo.scale(-1,1,1);
  if(!texRight){ sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft})); sphereLeft.layers.enable(1); sphereLeft.layers.enable(2); mediaGroup.add(sphereLeft); }
  else{ const top=INVERTER_OLHOS?0.5:0; texLeft.repeat.set(1,0.5); texLeft.offset.set(0,top); texLeft.needsUpdate=true; texRight.repeat.set(1,0.5); texRight.offset.set(0,top===0?0.5:0); texRight.needsUpdate=true; sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft})); sphereRight=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texRight})); sphereLeft.layers.set(1); sphereRight.layers.set(2); mediaGroup.add(sphereLeft,sphereRight); }
  const xrCam=renderer.xr.getCamera(camera); xrCam.layers.enable(1); xrCam.layers.enable(2);
}

function clearScene(){ mediaGroup.children.slice().forEach(c=>{ mediaGroup.remove(c); c.geometry.dispose(); c.material.map.dispose(); }); }
