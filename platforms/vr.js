// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.158.0/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, mediaGroup;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

const INVERTER_OLHOS = true;
const SNAP_THRESHOLD = 0.7;
const SNAP_ANGLE     = 20;
const SNAP_RAD       = THREE.MathUtils.degToRad(SNAP_ANGLE);

let snappedLeft = false, snappedRight = false;
let prevButtonPressed = false;
let gripL = null, gripR = null;
let leftPresent = false, rightPresent = false;
const prevButtonStates = { left: [], right: [] };
let prevAxes = [0,0];

let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 15;
function logDebug(msg) {
  if (!debugMesh) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0,0,debugCanvas.width,debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,debugCanvas.width,debugCanvas.height);
  ctx.fillStyle = '#0f0'; ctx.font = '20px monospace';
  debugLogs.forEach((l,i)=>ctx.fillText(l,10,30+i*22));
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio*2);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  mediaGroup = new THREE.Group();
  scene.add(mediaGroup);

  camera = new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
  camera.position.set(0,0,0.1);
  scene.add(camera);

  // HUD debug
  debugCanvas = document.createElement('canvas');
  debugCanvas.width = 2048; debugCanvas.height = 1024;
  debugTexture = new THREE.CanvasTexture(debugCanvas);
  debugMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6,0.3),
    new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true })
  );
  debugMesh.position.set(0,-0.1,-0.5);
  camera.add(debugMesh);
  logDebug('🔧 DEBUG HUD ativo');

  // controllers
  const factory = new XRControllerModelFactory();
  [0,1].forEach(i=>renderer.xr.getController(i).visible=false);
  const whiteMat = model=>model.traverse(o=>{
    if(o.isMesh) o.material = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.3,metalness:0.4});
  });
  function spawnGrip(idx, label){
    const grip = renderer.xr.getControllerGrip(idx);
    grip.visible = false;
    const model = factory.createControllerModel(grip);
    whiteMat(model);
    grip.add(model);
    grip.addEventListener('connected',()=>{ grip.visible=true; logDebug(`🟢 ${label} conectado`) });
    grip.addEventListener('disconnected',()=>{ grip.visible=false; logDebug(`🔴 ${label} desconectado`) });
    scene.add(grip);
    return grip;
  }
  gripL = spawnGrip(0,'Left');
  gripR = spawnGrip(1,'Right');

  renderer.setAnimationLoop(()=>{
    renderer.render(scene, camera);
    const session = renderer.xr.getSession();
    if(!session) return;

    // toggle HUD c/ botão 3
    let btn3=false;
    session.inputSources.forEach(src=>{
      const gp=src.gamepad;
      if(gp && gp.buttons[3]?.pressed) btn3=true;
    });
    if(btn3 && !prevButtonPressed) debugMesh.visible = !debugMesh.visible;
    prevButtonPressed = btn3;

    // detect controllers
    let fL=false, fR=false;
    session.inputSources.forEach(src=>{
      if(src.handedness==='left') fL=true;
      if(src.handedness==='right') fR=true;
    });
    if(fL!==leftPresent) logDebug(fL?'🟢 Left presente':'🔴 Left ausente');
    if(fR!==rightPresent) logDebug(fR?'🟢 Right presente':'🔴 Right ausente');
    leftPresent=fL; rightPresent=fR; gripL.visible=fL; gripR.visible=fR;

    // input & snap
    session.inputSources.forEach(src=>{
      if(!src.gamepad) return;
      const gp = src.gamepad, hand=src.handedness;
      // buttons
      gp.buttons.forEach((b,i)=>{
        const prev = prevButtonStates[hand][i]||false;
        if(b.pressed && !prev) logDebug(`🎮 [${hand}] button[${i}] pressed`);
        if(!b.pressed && prev) logDebug(`❌ [${hand}] button[${i}] released`);
        prevButtonStates[hand][i]=b.pressed;
      });
      // axes + snap
      if(gp.axes.length>=2 && hand==='left'){
        const x = gp.axes.length>=4?gp.axes[2]:gp.axes[0];
        const y = gp.axes.length>=4?gp.axes[3]:gp.axes[1];
        // log axes
        if(Math.abs(x-prevAxes[0])>0.1||Math.abs(y-prevAxes[1])>0.1){
          logDebug(`🎯 [${hand}] axes x=${x.toFixed(2)},y=${y.toFixed(2)}`);
          prevAxes=[x,y];
        }
        // snap turn
        if(x>=SNAP_THRESHOLD && !snappedRight){
          mediaGroup.rotation.y -= SNAP_RAD; snappedRight=true; snappedLeft=false;
          logDebug(`➡️ Snap ${SNAP_ANGLE}°`);
        } else if(x<=-SNAP_THRESHOLD && !snappedLeft){
          mediaGroup.rotation.y += SNAP_RAD; snappedLeft=true; snappedRight=false;
          logDebug(`⬅️ Snap ${SNAP_ANGLE}°`);
        }
        if(x<SNAP_THRESHOLD && x>-SNAP_THRESHOLD) snappedLeft=snappedRight=false;
      }
    });
  });

  inited = true;
  logDebug('🚀 initXR pronto');
}

export async function load(media) {
  if(!inited) throw new Error('initXR deve rodar antes de load()');
  clearScene();
  await loadMedia(media);
  logDebug(`📂 Loaded ${media.name}`);
}

function clearScene(){
  mediaGroup.children.slice().forEach(o=>{
    mediaGroup.remove(o);
    o.geometry?.dispose();
    o.material?.map?.dispose();
    o.material?.dispose();
  });
  sphereLeft=sphereRight=null;
  if(videoEl){ videoEl.pause(); videoEl.remove(); videoEl=null; }
  texLeft?.dispose(); texRight?.dispose();
  texLeft=texRight=null;
}

async function loadMedia(media){
  if(media.type==='video'){
    videoEl=document.createElement('video');
    Object.assign(videoEl,{src:media.cachePath,loop:true,muted:true,playsInline:true,crossOrigin:'anonymous'});
    await videoEl.play();
    texLeft=new THREE.VideoTexture(videoEl);
    texRight=media.stereo?new THREE.VideoTexture(videoEl):null;
  } else {
    const base=await new Promise((r,j)=>new THREE.TextureLoader().load(media.cachePath,r,undefined,j));
    texLeft=base; texRight=media.stereo?base.clone():null;
  }

  // settings idênticos ao desktop.js
  const maxA = renderer.capabilities.getMaxAnisotropy();
  [texLeft,texRight].forEach(t=>{
    if(!t) return;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipMapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = maxA;
  });

  // split stereo topo/baixo exato
  if(media.stereo){
    const top = INVERTER_OLHOS?0.5:0.0;
    texLeft.repeat.set(1,0.5); texLeft.offset.set(0,top);
    texRight.repeat.set(1,0.5);texRight.offset.set(0,top===0?0.5:0.0);
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0);
  }
  texLeft.needsUpdate=true; texRight?.needsUpdate=true;

  // esfera 360 top
  const geo=new THREE.SphereGeometry(500,128,64);
  geo.scale(-1,1,1);
  if(!media.stereo){
    sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft}));
    sphereLeft.layers.enable(1); sphereLeft.layers.enable(2);
    mediaGroup.add(sphereLeft);
  } else {
    sphereLeft=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texLeft}));
    sphereRight=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texRight}));
    sphereLeft.layers.set(1); sphereRight.layers.set(2);
    mediaGroup.add(sphereLeft,sphereRight);
  }
}
