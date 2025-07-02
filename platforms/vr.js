// platforms/vr.js
import * as THREE from '../libs/three.module.js';
import { setupVRInputs } from './vr_inputs.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Toggle pra inverter os olhos (debug)
const INVERTER_OLHOS = false;

/**
 * Inicializa WebXR no renderer existente, cria cena/câmera e liga o loop de render.
 * Também configura os inputs do controle (A/B) via setupVRInputs.
 * @param {THREE.WebGLRenderer} externalRenderer
 * @param {Function} onNext
 * @param {Function} onPrev
 */
export async function initXR(externalRenderer, onNext, onPrev) {
  if (inited) return;

  // 1) cena e câmera primeiro
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  // 2) pega o renderer da plataforma
  renderer = externalRenderer;
  renderer.xr.enabled = true;

  // 3) configura o polling dos botões A/B
  setupVRInputs(renderer, onNext, onPrev);

  // 4) liga o loop de render com cena/câmera já criadas
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  inited = true;
}

/**
 * Carrega a mídia na cena VR (deve chamar initXR antes).
 */
export async function load(media) {
  if (!inited) throw new Error('Você deve chamar initXR(renderer, onNext, onPrev) antes de load()');
  await loadMedia(media);
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(mesh => {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map && mesh.material.map.dispose();
    mesh.material.dispose();
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

  // carrega textura (vídeo ou imagem)
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

  // configura top-down stereo
  const repeatStereo = new THREE.Vector2(1, 0.5);
  const offsetTop    = new THREE.Vector2(0, 0);
  const offsetBot    = new THREE.Vector2(0, 0.5);

  // se não for estéreo, exibe tudo no texLeft
  if (!media.stereo) {
    texLeft.wrapS = texLeft.wrapT = THREE.ClampToEdgeWrapping;
    texLeft.repeat.set(1,1);
    texLeft.offset.set(0,0);
    texLeft.needsUpdate = true;

    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1,1,1);
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    return;
  }

  // stereo top-down
  [texLeft, texRight].forEach(tex => {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.copy(repeatStereo);
    tex.needsUpdate = true;
  });

  // aplica offsets com toggle de debug
  if (!INVERTER_OLHOS) {
    texLeft.offset.copy(offsetTop);
    texRight.offset.copy(offsetBot);
  } else {
    // invertido pra debug
    texLeft.offset.copy(offsetBot);
    texRight.offset.copy(offsetTop);
  }

  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1,1,1);

  // olho esquerdo → layer 1
  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  // olho direito → layer 2
  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // habilita as layers
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
