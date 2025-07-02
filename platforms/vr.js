// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// debug toggles (opcional)
const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG   = false; // desliga o overlay pra focar na mídia

// referências aos botões HTML
const btnPrev = document.getElementById('prevBtn');
const btnNext = document.getElementById('nextBtn');

export async function initXR(externalRenderer) {
  if (inited) return;

  // 1) Cena e câmera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  // 2) Reusa o mesmo canvas e renderer do desktop/mobile
  renderer = externalRenderer;

  // **Ajustes de qualidade máxima no VR**:
  // mantém pixel ratio alto
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  // faz o framebuffer XR usar a mesma escala
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  // sem tone mapping pra não esmaecer cor
  renderer.toneMapping = THREE.NoToneMapping;
  // cores corretas (sRGB)
  renderer.outputEncoding = THREE.sRGBEncoding;

  // 3) (Opcional) overlay debug — desliguei pra não atrapalhar
  if (SHOW_VR_DEBUG) {
    // ... seu código de debug canvas aqui ...
  }

  // 4) Estado anterior dos gamepads
  const prevStates = {};

  // 5) Loop de render + polling de VR buttons
  renderer.setAnimationLoop((time, frame) => {
    // renderiza cena VR
    renderer.render(scene, camera);

    // polling de gamepads
    const gps = navigator.getGamepads();
    for (const gp of gps) {
      if (!gp) continue;
      const id = gp.id;
      if (!prevStates[id]) prevStates[id] = gp.buttons.map(_ => false);

      gp.buttons.forEach((btn, idx) => {
        if (btn.pressed && !prevStates[id][idx]) {
          // botão A (4) → next, B (5) → prev
          if (idx === 4) btnNext.click();
          if (idx === 5) btnPrev.click();
        }
        prevStates[id][idx] = btn.pressed;
      });
    }
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
    videoEl.remove();
    videoEl = null;
  }
  texLeft = texRight = null;
  sphereLeft = sphereRight = null;
}

async function loadMedia(media) {
  clearScene();

  // 1) Carrega textura de vídeo ou imagem
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

    texLeft = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
    texLeft = base;
    texRight = media.stereo ? base.clone() : null;
  }

  // 2) **Filtros de alta qualidade** e sRGB
  [texLeft, texRight].forEach(tex => {
    if (!tex) return;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  });

  // 3) Aplica crop stereo top-down se for estéreo
  if (media.stereo) {
    texLeft.repeat.set(1, 0.5);
    texLeft.offset.set(0, 0);
    texRight.repeat.set(1, 0.5);
    texRight.offset.set(0, 0.5);
    texLeft.needsUpdate = texRight.needsUpdate = true;
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
  }

  // 4) Monta esfera invertida
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

  // 5) Habilita layers da camera XR
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
