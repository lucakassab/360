// platforms/vr.js

import * as THREE from '../libs/three.module.js';
import { VRButton } from '../libs/VRButton.js';

let scene, camera;
export let renderer;         // agora exportamos renderer
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let initialized = false;

// exporta initXR para o core.js poder chamar antes de criar o botão
export async function initXR() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('xr-canvas'),
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  // botao é criado no core.js, mas podemos opcionalmente adicionar aqui também:
  // document.body.appendChild(VRButton.createButton(renderer));

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  initialized = true;
}

export async function load(media) {
  // garante que initXR já tenha rodado
  if (!initialized) {
    await initXR();
  }
  await loadMedia(media);
}

function clearScene() {
  // remove e dispose das esferas anteriores
  [sphereLeft, sphereRight].forEach(mesh => {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map && mesh.material.map.dispose();
    mesh.material.dispose();
  });
  // limpa vídeo
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

  // cria as texturas
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    videoEl.src = media.cachePath;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res, rej) => 
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

  // ajusta offset/repeat para estéreo lado-a-lado
  if (media.stereo) {
    texLeft.repeat.set(0.5, 1);
    texLeft.offset.set(0, 0);
    texRight.repeat.set(0.5, 1);
    texRight.offset.set(0.5, 0);
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
  }
  texLeft.needsUpdate = true;
  if (texRight) texRight.needsUpdate = true;

  // monta esfera invertida
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    const mat = new THREE.MeshBasicMaterial({ map: texLeft });
    sphereLeft = new THREE.Mesh(geo, mat);
    scene.add(sphereLeft);
    return;
  }

  // cria esfera para cada olho
  const matL = new THREE.MeshBasicMaterial({ map: texLeft });
  sphereLeft = new THREE.Mesh(geo, matL);
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  const matR = new THREE.MeshBasicMaterial({ map: texRight });
  sphereRight = new THREE.Mesh(geo, matR);
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // habilita layers na câmera XR
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
