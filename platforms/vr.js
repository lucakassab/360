// platforms/vr.js
import * as THREE from '../libs/three.module.js';

let scene, camera;
export let renderer;
let sphereLeft, sphereRight;
let videoEl, texLeft, texRight;
let inited = false;

// 🔁 Debug toggles
const INVERTER_OLHOS = true;
const SHOW_VR_DEBUG  = true;

// debug overlay
let debugCanvas, debugTexture, debugMesh;
let debugLogs = [];
const MAX_LOGS = 10;
// conversão de pixels do canvas para metros no mundo 3D
const PX_TO_M = 0.001;

function logDebug(msg) {
  if (!SHOW_VR_DEBUG) return;

  // adiciona e limita linhas
  debugLogs.push(msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();

  const ctx = debugCanvas.getContext('2d');
  ctx.font = '20px monospace';
  const padding = 10;
  const lineHeight = 22;

  // calcula largura máxima
  let maxWidth = 0;
  for (const line of debugLogs) {
    const w = ctx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }

  // novas dimensões do canvas
  const canvasW = Math.ceil(maxWidth + padding * 2);
  const canvasH = Math.ceil(debugLogs.length * lineHeight + padding * 2);

  // redimensiona canvas e redesenha
  debugCanvas.width = canvasW;
  debugCanvas.height = canvasH;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#0f0';
  ctx.font = '20px monospace';

  debugLogs.forEach((line, i) => {
    ctx.fillText(line, padding, padding + (i+1)*lineHeight - 5);
  });

  debugTexture.needsUpdate = true;

  // ajusta escala do mesh (mantendo geometria 1×1)
  debugMesh.scale.set(canvasW * PX_TO_M, canvasH * PX_TO_M, 1);
}

export async function initXR(externalRenderer) {
  if (inited) return;

  // 1) Cena + câmera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  // 2) Reutiliza o canvas/renderer e força máxima qualidade
  renderer = externalRenderer;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(window.devicePixelRatio);
  renderer.toneMapping    = THREE.NoToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // 3) Overlay de debug (uma só geometria 1×1, depois escalada)
  if (SHOW_VR_DEBUG) {
    debugCanvas = document.createElement('canvas');
    debugCanvas.width  = 512;
    debugCanvas.height = 256;
    debugTexture = new THREE.CanvasTexture(debugCanvas);

    const mat  = new THREE.MeshBasicMaterial({ map: debugTexture, transparent: true });
    const geo  = new THREE.PlaneGeometry(1, 1);
    debugMesh   = new THREE.Mesh(geo, mat);
    // escala inicial (pode ser pequena, será ajustada no primeiro logDebug)
    debugMesh.scale.set(
      debugCanvas.width * PX_TO_M,
      debugCanvas.height * PX_TO_M,
      1
    );
    debugMesh.position.set(0, -0.1, -0.5);

    camera.add(debugMesh);
    scene.add(camera);

    // loga o dispositivo XR detectado
    const ua  = navigator.userAgent;
    const low = ua.toLowerCase();
    let deviceName = 'Desconhecido';
    if (low.includes('quest pro')) deviceName = 'Meta Quest Pro';
    else if (low.includes('quest 3'))   deviceName = 'Meta Quest 3';
    else if (low.includes('quest 2'))   deviceName = 'Meta Quest 2';
    else if (low.includes('quest'))     deviceName = 'Meta Quest';
    else if (low.includes('oculusbrowser')) deviceName = 'Oculus Browser';
    logDebug(`🎮 Dispositivo XR: ${deviceName}`);
    logDebug(`🖥️ User-Agent: ${ua}`);
  }

  // 4) Adiciona cubos aos grips dos controllers
  const grip0 = renderer.xr.getControllerGrip(0);
  const cube0 = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  grip0.add(cube0);
  scene.add(grip0);
  if (SHOW_VR_DEBUG) logDebug('✅ Cubo verde (esq) adicionado');

  const grip1 = renderer.xr.getControllerGrip(1);
  const cube1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  grip1.add(cube1);
  scene.add(grip1);
  if (SHOW_VR_DEBUG) logDebug('✅ Cubo vermelho (dir) adicionado');

  // 5) Inicia loop de render
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  inited = true;
  if (SHOW_VR_DEBUG) logDebug('🚀 initXR concluído');
}

export async function load(media) {
  if (!inited) throw new Error('initXR(renderer) deve rodar antes de load()');
  if (SHOW_VR_DEBUG) logDebug(`📂 Carregando: ${media.name}`);
  await loadMedia(media);
  if (SHOW_VR_DEBUG) logDebug('✅ loadMedia concluído');
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
  texLeft    = texRight    = null;
  if (SHOW_VR_DEBUG) logDebug('🧹 Cena limpa');
}

async function loadMedia(media) {
  clearScene();

  // 1) Cria textura
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
    if (SHOW_VR_DEBUG) logDebug('🎥 VideoTexture criada');
  } else {
    const loader = new THREE.TextureLoader();
    const base   = await new Promise((res, rej) =>
      loader.load(media.cachePath, res, undefined, rej)
    );
    texLeft  = base;
    texRight = media.stereo ? base.clone() : null;
    if (SHOW_VR_DEBUG) logDebug('📷 TextureLoader carregou imagem');
  }

  // 2) Filtros de alta qualidade
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
  if (SHOW_VR_DEBUG) logDebug('🔧 Filtros aplicados');

  // 3) Stereo top-down / inversão
  if (media.stereo) {
    const top = INVERTER_OLHOS ? 0.5 : 0.0;
    const bot = INVERTER_OLHOS ? 0.0 : 0.5;
    texLeft.repeat.set(1, 0.5);
    texRight.repeat.set(1, 0.5);
    texLeft.offset.set(0, top);
    texRight.offset.set(0, bot);
    texLeft.needsUpdate  = true;
    texRight?.needsUpdate = true;
    if (SHOW_VR_DEBUG) logDebug(`🔀 Stereo aplicado (invertido: ${INVERTER_OLHOS})`);
  } else {
    texLeft.repeat.set(1,1);
    texLeft.offset.set(0,0);
    texLeft.needsUpdate = true;
    if (SHOW_VR_DEBUG) logDebug('⚪ Mono aplicado');
  }

  // 4) Monta esfera invertida
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

  // 5) Ativa layers na câmera XR
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.layers.enable(1);
  xrCam.layers.enable(2);
}
