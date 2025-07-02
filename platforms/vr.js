// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Debug toggles
const INVERTER_OLHOS   = true;  // inverte top/bottom das metades estéreo
const SHOW_VR_DEBUG    = true;  // mostra a sobreposição de console no headset

// variáveis da sobreposição de debug
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;

function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';
  debugLogs.forEach((line, i) => {
    ctx.fillText(line, 10, 30 + i * 22);
  });
  debugTexture.needsUpdate = true;
}

export async function initXR(externalRenderer) {
  if (inited) return;

  // 1) Cena e câmera VR
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  // 2) Reusa canvas/renderer e aplica máxima qualidade
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // 3) Configura overlay de debug
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width  = 512;
    debugCanvas.height = 256;
    debugTexture = new THREE.CanvasTexture(debugCanvas);
    const mat = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo = new THREE.PlaneGeometry(0.6, 0.3);
    debugMesh = new THREE.Mesh(geo, mat);
    debugMesh.position.set(0, -0.1, -0.5);
    camera.add(debugMesh);
    scene.add(camera);

    // 3.1) Detecta dispositivo XR via User-Agent
    const ua  = navigator.userAgent;
    const lu  = ua.toLowerCase();
    let deviceName = 'Desconhecido';
    if (lu.includes('quest pro'))               deviceName = 'Meta Quest Pro';
    else if (lu.includes('quest 3') || lu.includes('quest3')) deviceName = 'Meta Quest 3';
    else if (lu.includes('quest 2') || lu.includes('quest2')) deviceName = 'Meta Quest 2';
    else if (lu.includes('quest'))               deviceName = 'Meta Quest';
    else if (lu.includes('oculusbrowser'))       deviceName = 'Oculus Browser';
    logDebug(`🎮 Dispositivo XR: ${deviceName}`);
    logDebug(`🖥️ User-Agent: ${ua}`);
  }

  // 4) Adiciona cubos nos grips dos controllers
  const grip0 = renderer.xr.getControllerGrip(0);
  const cube0 = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  grip0.add(cube0);
  scene.add(grip0);
  logDebug('✅ Cubo verde (esq) adicionado');

  const grip1 = renderer.xr.getControllerGrip(1);
  const cube1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  grip1.add(cube1);
  scene.add(grip1);
  logDebug('✅ Cubo vermelho (dir) adicionado');

  // 5) Loop de render
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  inited = true;
  logDebug('🚀 initXR concluído');
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  logDebug('✅ loadMedia concluído');
}

function clearScene() {
  [sphereLeft, sphereRight].forEach(mesh => {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map?.dispose();
    mesh.material.dispose();
  });
  if (videoEl) {
    videoEl.pause();
    videoEl.src = '';
    videoEl.load();
    videoEl.remove();
    videoEl = null;
  }
  if (texLeft?.dispose)  texLeft.dispose();
  if (texRight?.dispose) texRight.dispose();
  sphereLeft = sphereRight = null;
  texLeft = texRight = null;
  logDebug('🧹 Cena limpa');
}

async function loadMedia(media) {
  clearScene();

  // 1) Cria a textura (vídeo ou imagem)
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
    logDebug('🎥 VideoTexture criada');
  } else {
    const loader = new THREE.TextureLoader();
    const base = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
    logDebug('📷 TextureLoader carregou imagem');
  }

  // 2) Filtros de alta qualidade e sRGB
  [texLeft, texRight].forEach(tex => {
    if (!tex) return;
    tex.minFilter       = THREE.LinearFilter;
    tex.magFilter       = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.mapping         = THREE.EquirectangularReflectionMapping;
    tex.encoding        = THREE.sRGBEncoding;
    tex.wrapS           = THREE.ClampToEdgeWrapping;
    tex.wrapT           = THREE.RepeatWrapping;
  });
  logDebug('🔧 Filtros de alta qualidade aplicados');

  // 3) Crop stereo top-down com toggle de inversão
  if (media.stereo) {
    texLeft.repeat.set(1, 0.5);
    texRight.repeat.set(1, 0.5);
    const topOfs    = INVERTER_OLHOS ? 0.5 : 0.0;
    const botOfs    = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.offset.set(0, topOfs);
    texRight.offset.set(0, botOfs);
    texLeft.needsUpdate  = true;
    texRight.needsUpdate = true;
    logDebug(`🔀 Stereo aplicado (invertido: ${INVERTER_OLHOS})`);
  } else {
    texLeft.repeat.set(1, 1);
    texLeft.offset.set(0, 0);
    texLeft.needsUpdate = true;
    logDebug('⚪ Mono aplicado');
  }

  // 4) Monta a esfera invertida
  const geo = new THREE.SphereGeometry(500, 60, 40);
  geo.scale(-1, 1, 1);
  if (!media.stereo) {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    scene.add(sphereLeft);
  } else {
    sphereLeft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texLeft }));
    sphereLeft.layers.set(1);
    scene.add(sphereLeft);
    sphereRight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texRight }));
    sphereRight.layers.set(2);
    scene.add(sphereRight);
  }

  // 5) Ativa a renderização por layer dos olhos
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
  logDebug('🌐 Cena VR pronta');
}
