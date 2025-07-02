// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Toggle pra inverter os olhos (debug)
const INVERTER_OLHOS = true;

export async function initXR(externalRenderer) {
  if (inited) return;
  renderer = externalRenderer;
  renderer.xr.enabled = true;
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);
  inited = true;
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) precisa rodar antes de load()');
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

  // carrega a textura (vídeo ou imagem)
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

  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    return;
  }

  // stereo top-down com toggle de inversão
  const offsetTop    = new THREE.Vector2(0, 0);
  const offsetBottom = new THREE.Vector2(0, 0.5);
  const repeatStereo = new THREE.Vector2(1, 0.5);

  const texL = texLeft;
  const texR = texRight;

  texL.wrapS = texR.wrapS = THREE.ClampToEdgeWrapping;
  texL.wrapT = texR.wrapT = THREE.RepeatWrapping;
  texL.repeat.copy(repeatStereo);
  texR.repeat.copy(repeatStereo);
  texL.offset.copy(INVERTER_OLHOS ? offsetBottom : offsetTop);
  texR.offset.copy(INVERTER_OLHOS ? offsetTop    : offsetBottom);
  texL.needsUpdate = true;
  texR.needsUpdate = true;

  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texL }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texR }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
