// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// Agora aceita um renderer já existente
export async function initXR(externalRenderer) {
  if (inited) return;
  // 1) reutiliza o canvas/renderer já criado
  renderer = externalRenderer;
  // 2) ativa WebXR e loop de render
  renderer.xr.enabled = true;

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  // 3) cria cena e câmera VR
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  inited = true;
}

// load = initXR (se necessário) + loadMedia
export async function load(media) {
  if (!inited) throw new Error('Você deve chamar initXR(renderer) antes de load');
  await loadMedia(media);
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
  // (mesma lógica de textura do seu vr.js anterior)
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
      loader.load(media.cachePath,res,undefined,rej)
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
    texLeft.repeat.set(0.5,1);  texLeft.offset.set(0,0);
    texRight.repeat.set(0.5,1); texRight.offset.set(0.5,0);
    texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1,1); texLeft.offset.set(0,0);
  }
  texLeft.needsUpdate = true;

  const geo = new THREE.SphereGeometry(500,60,40);
  geo.scale(-1,1,1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    return scene.add(sphereLeft);
  }

  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // ativa layers na camera XR
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
