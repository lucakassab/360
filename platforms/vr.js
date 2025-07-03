// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

const SHOW_VR_DEBUG = true;
const INVERTER_OLHOS = true;
const SNAP_THRESHOLD = 0.7;
const SNAP_ANGLE_DEGREES = 20;
const SNAP_ANGLE_RADIANS = THREE.MathUtils.degToRad(SNAP_ANGLE_DEGREES);

let prevHUDToggle = false;
let hudVisible = false;
let prevButtonPressed = false;
let gripL = null, gripR = null;
let leftPresent = false, rightPresent = false;
const previousGamepadStates = new Map();
let debugCanvas, debugTexture, debugMesh, debugLogs = [];
const MAX_LOGS = 50;
// snap lock per hand
const snapLock = {};

function logDebug(msg) {
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0'; ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => ctx.fillText(line, 10, 30 + i * 22));
  debugTexture.needsUpdate = true;
}

function dumpMeshes(root, label) {
  root.traverse(o => { if (o.isMesh) logDebug(`📦 ${label}: mesh "${o.name}"`); });
}

export function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  clearScene();
  logDebug(`📂 Carregando: ${media.name}`);
  loadMedia(media);
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
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,0.1);
  scene.add(camera);

  // Point light above camera
  const pointLight = new THREE.PointLight(0xffffff, 1.5, 40, 2);
  pointLight.position.set(0,1,0);
  camera.add(pointLight);

  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas'); debugCanvas.width=2048; debugCanvas.height=1024;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({map:debugTexture,transparent:true});
    const geo = new THREE.PlaneGeometry(0.6,0.3);
    debugMesh = new THREE.Mesh(geo,mat); debugMesh.position.set(0,-0.1,-0.5); debugMesh.visible=false;
    camera.add(debugMesh);
    logDebug('version:1.20');
    const ua = navigator.userAgent.toLowerCase();
    const device = ua.includes('quest pro')?'Meta Quest Pro':ua.includes('quest 3')?'Meta Quest 3':ua.includes('quest 2')?'Meta Quest 2':ua.includes('quest')?'Meta Quest':ua.includes('oculusbrowser')?'Oculus Browser':'Desconhecido';
    logDebug(`🎮 Dispositivo XR: ${device}`);
  }

  const factory = new XRControllerModelFactory();
  [0,1].forEach(i=>renderer.xr.getController(i).visible=false);
  const whiteMat = model => model.traverse(o=>{ if(o.isMesh) o.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.4}); });

  function spawnGrip(idx,label) {
    const grip = renderer.xr.getControllerGrip(idx);
    grip.visible=false;
    const model = factory.createControllerModel(grip);
    whiteMat(model); grip.add(model);
    model.addEventListener('connected',()=>dumpMeshes(model,`${label} ready`));
    grip.addEventListener('connected',()=>{ grip.visible=true; logDebug(`🟢 ${label} conectado`); });
    grip.addEventListener('disconnected',()=>{ grip.visible=false; logDebug(`🔴 ${label} desconectado`); });
    scene.add(grip); return grip;
  }
  gripL = spawnGrip(0,'Left'); gripR = spawnGrip(1,'Right');

  renderer.setAnimationLoop(()=>{
    renderer.render(scene,camera);
    const session = renderer.xr.getSession(); if(!session) return;

    // poll all buttons
    session.inputSources.forEach(src=>{
      const gp=src.gamepad; if(!gp) return;
      const id=`${src.handedness}|${gp.id}`;
      const prev=previousGamepadStates.get(id)||[];
      gp.buttons.forEach((b,i)=>{ if(b.pressed && !prev[i]) logDebug(`[${src.handedness}] button[${i}] pressed`); });
      previousGamepadStates.set(id,gp.buttons.map(b=>b.pressed));
    });

    // toggle HUD on button 3
    let btn3=false;
    session.inputSources.forEach(src=>{ const gp=src.gamepad; if(gp&&gp.buttons[3]?.pressed) btn3=true; });
    if(btn3 && !prevHUDToggle){ hudVisible=!hudVisible; debugMesh.visible=hudVisible; }
    prevHUDToggle=btn3;

    // detect controllers
    let L=false,R=false;
    session.inputSources.forEach(src=>{ if(src.handedness==='left')L=true; if(src.handedness==='right')R=true; });
    if(L!==leftPresent) logDebug(L?'🟢 L presente':'🔴 L ausente');
    if(R!==rightPresent) logDebug(R?'🟢 R presente':'🔴 R ausente');
    leftPresent=L; rightPresent=R; gripL.visible=L; gripR.visible=R;

    // snap turn both sticks, one snap per push
    session.inputSources.forEach(src=>{
      const gp=src.gamepad; if(!gp||gp.axes.length<2) return;
      const hand=src.handedness;
      const x=gp.axes.length>=4?gp.axes[2]:gp.axes[0];
      if(Math.abs(x)<SNAP_THRESHOLD){ snapLock[hand]=false; return; }
      if(!snapLock[hand]){
        const dir = x>0?1:-1;
        mediaGroup.rotation.y += dir*SNAP_ANGLE_RADIANS;
        logDebug(dir>0?'➡️ Snap':'⬅️ Snap');
        snapLock[hand]=true;
      }
    });
  });

  inited=true; logDebug('🚀 initXR pronto');
}

function loadMedia(media){
  if(videoEl){ videoEl.pause(); videoEl.remove(); }
  if(media.type==='video'){
    videoEl=document.createElement('video');
    Object.assign(videoEl,{src:media.cachePath,loop:true,muted:true,playsInline:true,crossOrigin:'anonymous'});
    videoEl.play(); texLeft=new THREE.VideoTexture(videoEl); texRight=media.stereo?new THREE.VideoTexture(videoEl):null;
    setupTexture(); applyTexture();
  } else new THREE.TextureLoader().load(media.cachePath,tex=>{ texLeft=tex; texRight=media.stereo?tex.clone():null; setupTexture(); applyTexture(); });
}

function setupTexture(){
  const maxA=renderer.capabilities.getMaxAnisotropy();
  [texLeft,texRight].forEach(t=>{ if(!t)return; t.mapping=THREE.EquirectangularReflectionMapping; t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.generateMipmaps=true; t.minFilter=THREE.LinearMipMapLinearFilter; t.magFilter=THREE.LinearFilter; t.anisotropy=maxA; });
}

function applyTexture(){
  clearScene(); const geo=new THREE.SphereGeometry(500,128,128); geo.scale(-1,1,1);
  if(!texRight){ sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft})); sphereLeft.layers.enable(1); sphereLeft.layers.enable(2); mediaGroup.add(sphereLeft); }
  else { const top=INVERTER_OLHOS?0.5:0.0; texLeft.repeat.set(1,0.5); texLeft.offset.set(0,top); texLeft.needsUpdate=true; texRight.repeat.set(1,0.5); texRight.offset.set(0,top===0?0.5:0); texRight.needsUpdate=true; sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft})); sphereRight=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texRight})); sphereLeft.layers.set(1); sphereRight.layers.set(2); mediaGroup.add(sphereLeft,sphereRight); }
  const xrCam=renderer.xr.getCamera(camera); xrCam.layers.enable(1); xrCam.layers.enable(2);
}

function clearScene(){ mediaGroup.children.slice().forEach(c=>{ mediaGroup.remove(c); c.geometry.dispose(); c.material.map.dispose(); }); }
