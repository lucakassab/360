// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// toggle pra inverter olhos
const INVERTER_OLHOS = true;

export async function initXR(externalRenderer) {
  if (inited) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  renderer.setAnimationLoop((time, frame) => {
    renderer.render(scene, camera);
    // ... teu polling de botões VR aqui, se tiver ...
  });

  inited = true;
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  await loadMedia(media);
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(m => {
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  });
  if (videoEl) {
    videoEl.pause();
    document.body.contains(videoEl) && videoEl.remove();
    videoEl = null;
  }
  texLeft = texRight = null;
  sphereLeft = sphereRight = null;
}

async function loadMedia(media) {
  clearScene();

  // 1) cria Textures
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
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
  }

  // 2) filtros de alta qualidade e sRGB
  [texLeft, texRight].forEach(tex => {
    if (!tex) return;
    tex.minFilter    = THREE.LinearFilter;
    tex.magFilter    = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.mapping      = THREE.EquirectangularReflectionMapping;
    tex.encoding     = THREE.sRGBEncoding;
    tex.wrapS        = THREE.ClampToEdgeWrapping;
    tex.wrapT        = THREE.RepeatWrapping;
  });

  // 3) agora aplica o crop top-down com toggle de inversão
  if (media.stereo) {
    texLeft.repeat.set(1, 0.5);
    texRight.repeat.set(1, 0.5);

    const offsetTop    = INVERTER_OLHOS ? 0.5 : 0.0;
    const offsetBottom = INVERTER_OLHOS ? 0.0 : 0.5;

    texLeft.offset.set(0, offsetTop);
    texRight.offset.set(0, offsetBottom);

    texLeft.needsUpdate  = true;
    texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
  }

  // 4) cria as esferas
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    return;
  }

  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  // 5) ativa layers na câmera XR
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
