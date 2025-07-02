// platforms/vr.js

import * as THREE from '../libs/three.module.js';

let scene, camera, renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// expõe renderer pra VRButton
export let renderer;

// initXR separado, sem criar botao
export async function initXR() {
  console.log('vr.js → initXR()');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75, window.innerWidth/window.innerHeight, 0.1, 1000
  );
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('xr-canvas'),
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  renderer.setAnimationLoop(()=>{
    renderer.render(scene, camera);
  });

  inited = true;
  console.log('vr.js → initXR done');
}

// load = initXR + loadMedia
export async function load(media) {
  console.log('vr.js.load()', media);
  if (!inited) await initXR();
  await loadMedia(media);
  console.log('vr.js.load() done');
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(m=>{
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.map && m.material.map.dispose();
    m.material.dispose();
  });
  if (videoEl) {
    videoEl.pause();
    videoEl.remove();
    videoEl = null;
  }
  texLeft = texRight = null;
  sphereLeft = sphereRight = null;
}

async function loadMedia(media) {
  clearScene();
  console.log('vr.js.loadMedia()', media);

  // cria textura
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    videoEl.src = media.cachePath;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = videoEl.muted = videoEl.playsInline = true;
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res,rej)=>
      loader.load(media.cachePath, res, undefined, rej)
    );
    base.mapping  = THREE.EquirectangularReflectionMapping;
    base.encoding = THREE.sRGBEncoding;
    if (media.stereo) {
      texLeft  = base.clone();
      texRight = base.clone();
    } else {
      texLeft  = base;
      texRight = null;
    }
  }

  // stereo lado-a-lado
  if (media.stereo) {
    texLeft.repeat.set(0.5,1);
    texLeft.offset.set(0,0);
    texRight.repeat.set(0.5,1);
    texRight.offset.set(0.5,0);
    texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1,1);
    texLeft.offset.set(0,0);
  }
  texLeft.needsUpdate = true;

  const geo = new THREE.SphereGeometry(500,60,40);
  geo.scale(-1,1,1);

  if (!media.stereo) {
    const mat = new THREE.MeshBasicMaterial({ map: texLeft });
    sphereLeft = new THREE.Mesh(geo, mat);
    scene.add(sphereLeft);
    return;
  }

  const matL = new THREE.MeshBasicMaterial({ map: texLeft });
  sphereLeft = new THREE.Mesh(geo, matL);
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  const matR = new THREE.MeshBasicMaterial({ map: texRight });
  sphereRight = new THREE.Mesh(geo, matR);
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
  console.log('vr.js.loadMedia done');
}
