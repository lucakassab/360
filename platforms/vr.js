// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// debug toggles (você pode desligar)
const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG   = true;

// referências aos botões HTML
const btnPrev = document.getElementById('prevBtn');
const btnNext = document.getElementById('nextBtn');

// overlay de debug
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;
function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0'; ctx.font = '20px monospace';
  debugLogs.forEach((line,i) => ctx.fillText(line, 10, 30 + i*22));
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;

  // 1) Nova cena e câmera VR
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,0.1);

  // 2) Mesma canvas/renderer do desktop/mobile
  renderer = externalRenderer;
  renderer.xr.enabled = true;

  // 3) Overlay de debug
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width = 512; debugCanvas.height = 256;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.4,0.2);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0,-0.1,-0.5);
    camera.add(debugMesh);
    scene.add(camera);
  }

  // 4) Estado anterior dos gamepads
  const prevStates = {};

  // 5) Loop de render + polling de gamepad
  renderer.setAnimationLoop((time, frame) => {
    // **renderiza cena VR**
    renderer.render(scene, camera);

    // **poll dos gamepads**
    const gps = navigator.getGamepads();
    for (const gp of gps) {
      if (!gp) continue;
      // usa id do gp para diferenciar controles
      const id = gp.id;
      if (!prevStates[id]) prevStates[id] = gp.buttons.map(_=>false);

      gp.buttons.forEach((btn, idx) => {
        // transição: não-pressionado → pressionado
        if (btn.pressed && !prevStates[id][idx]) {
          logDebug(`RAW: ${id} button[${idx}]`);
          // botão 4 = A, botão 5 = B no Quest
          if (idx === 4) {
            logDebug('🔵 Botão A → NEXT');
            btnNext.click();
          }
          if (idx === 5) {
            logDebug('🟣 Botão B → PREV');
            btnPrev.click();
          }
        }
        // atualiza estado
        prevStates[id][idx] = btn.pressed;
      });
    }
  });

  inited = true;
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  logDebug(`📂 Carregando: ${media.name}`);
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

  // cria a textura (vídeo ou imagem)
  if (media.type === 'video') {
    videoEl = document.createElement('video');
    Object.assign(videoEl, {
      src: media.cachePath,
      crossOrigin: 'anonymous',
      loop: true, muted: true, playsInline: true
    });
    await videoEl.play();
    texLeft  = new THREE.VideoTexture(videoEl);
    texRight = media.stereo ? new THREE.VideoTexture(videoEl) : null;
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res,rej) =>
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

  // esfera invertida
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1,1,1);

  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
    return;
  }

  // stereo top-down
  const repeatStereo = new THREE.Vector2(1,0.5);
  const offsetTop    = new THREE.Vector2(0,0);
  const offsetBot    = new THREE.Vector2(0,0.5);

  [texLeft, texRight].forEach(tex => {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.copy(repeatStereo);
    tex.needsUpdate = true;
  });

  if (!INVERTER_OLHOS) {
    texLeft.offset.copy(offsetTop);
    texRight.offset.copy(offsetBot);
  } else {
    texLeft.offset.copy(offsetBot);
    texRight.offset.copy(offsetTop);
  }

  sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
  sphereLeft.layers.set(1);
  scene.add(sphereLeft);

  sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
  sphereRight.layers.set(2);
  scene.add(sphereRight);

  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
