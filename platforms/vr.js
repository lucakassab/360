import * as THREE from '../libs/three.module.js';
import { VRButton } from '../libs/VRButton.js'; // pegue o VRButton.js em three.js/examples/jsm/webxr/VRButton.js e coloque em /libs

let scene, camera, renderer;
let sphereLeft, sphereRight;
let videoEl;
let texLeft, texRight;
let initialized = false;

const canvas = document.getElementById('xr-canvas');

export async function load(media) {
  if (!initialized) {
    await initXR();
    initialized = true;
  }
  await loadMedia(media);
}

async function initXR() {
  // Cena e câmera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  // Renderer com XR enabled
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  // Botão de entrar em VR
  document.body.appendChild(VRButton.createButton(renderer));

  // Loop de renderização
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function clearScene() {
  // Remove e dispose das esferas
  [sphereLeft, sphereRight].forEach(mesh => {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
  });
  sphereLeft = sphereRight = null;

  // Para vídeo e dispose
  if (videoEl) {
    videoEl.pause();
    videoEl.remove();
    videoEl = null;
  }
  texLeft?.dispose();
  texRight?.dispose();
  texLeft = texRight = null;
}

async function loadMedia(media) {
  clearScene();

  // Cria texturas
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    videoEl.src = media.cachePath;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();

    // Duas texturas pro mesmo elemento
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = new THREE.VideoTexture(videoEl);
  } else {
    const loader = new THREE.TextureLoader();
    const baseTex = await new Promise((res, rej) => {
      loader.load(media.cachePath, res, undefined, rej);
    });
    baseTex.mapping  = THREE.EquirectangularReflectionMapping;
    baseTex.encoding = THREE.sRGBEncoding;

    if (media.stereo) {
      texLeft  = baseTex.clone();
      texRight = baseTex.clone();
    } else {
      texLeft  = baseTex;
      texRight = null;
    }
  }

  // Configura offsets/repeats
  if (media.stereo) {
    texLeft.repeat.set(0.5, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;

    texRight.repeat.set(0.5, 1);
    texRight.offset.set(0.5, 0);
    texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
  }

  // Geometria
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  // Mono
  if (!media.stereo) {
    const mat = new THREE.MeshBasicMaterial({ map: texLeft });
    sphereLeft = new THREE.Mesh(geo, mat);
    scene.add(sphereLeft);
    return;
  }

  // Estéreo: uma esfera p/ cada olho
  const matL = new THREE.MeshBasicMaterial({ map: texLeft });
  sphereLeft  = new THREE.Mesh(geo, matL);
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  const matR = new THREE.MeshBasicMaterial({ map: texRight });
  sphereRight = new THREE.Mesh(geo, matR);
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // Garante que as câmeras XR vão renderizar as duas layers
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
