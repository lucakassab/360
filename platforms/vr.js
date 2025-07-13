// platforms/vr.js

import * as THREE from '../libs/three.module.js';
import { initDebugWidget, addLog, getLogs, toggleDebugWidget } from './vr/vr_dbg_widget.js';
import { initControllers as initQuestControllers }   from './vr/quest.js';
import { initControllers as initGenericControllers } from './vr/generic_vr.js';

export let renderer;

let scene, camera, referenceSpace;
let monoMesh = null, leftMesh = null, rightMesh = null;
let videoElement = null, texture = null;

// Controla se o debug widget está disponível
const DEBUG_WIDGET = true;

/** Hijacks console.log so messages also appear in the 3D HUD */
function overrideConsole() {
  const orig = console.log.bind(console);
  console.log = (...args) => {
    orig(...args);
    if (DEBUG_WIDGET) {
      const msg = args
        .map(a => (typeof a === 'object' ? JSON.stringify(a) : a))
        .join(' ');
      addLog(msg);
    }
  };
}

/** Logs device & XR support info */
async function logEnvironment() {
  console.log('=== VR ENVIRONMENT ===');
  console.log('User Agent:', navigator.userAgent);
  if (navigator.userAgentData) {
    console.log('UA Data:', JSON.stringify(navigator.userAgentData));
  }
  console.log('Platform:', navigator.platform);
  console.log(
    `Screen: ${screen.width}x${screen.height} @ DPR ${window.devicePixelRatio}`
  );
  console.log('Hardware Concurrency:', navigator.hardwareConcurrency);
  console.log('Device Memory (GB):', navigator.deviceMemory || 'unknown');
  if (navigator.xr) {
    console.log(
      'Supports immersive-vr:',
      await navigator.xr.isSessionSupported('immersive-vr')
    );
    console.log(
      'Supports inline:',
      await navigator.xr.isSessionSupported('inline')
    );
  } else {
    console.log('navigator.xr not available');
  }
  console.log('=======================');
}

/**
 * Sets up scene, renderer, HUD, and controllers.
 * Falls back to generic controllers if Quest init fails.
 */
export async function init({ container, xrSession }) {
  container.innerHTML = '';
  overrideConsole();

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  scene.add(camera);

  // ─── Iluminação Básica ───
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemiLight.position.set(0, 1, 0);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0, 10, 10);
  dirLight.target.position.set(0, 0, 0);
  scene.add(dirLight);
  scene.add(dirLight.target);
  // dirLight.castShadow = true;

  // Debug HUD (inicialmente oculto se habilitado)
  if (DEBUG_WIDGET) {
    initDebugWidget(camera, scene);
    console.log('vr_dbg_widget inicializado');
    // Começa oculto
    toggleDebugWidget();
  }

  await logEnvironment();

  // Canvas & Renderer
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
    preserveDrawingBuffer: true
  });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);

  renderer.xr.setSession(xrSession);
  try {
    referenceSpace = await xrSession.requestReferenceSpace('local-floor');
  } catch {
    referenceSpace = await xrSession.requestReferenceSpace('local');
  }
  console.log('Sessão XR iniciada');

  // Stereo Layers
  const xrCam = renderer.xr.getCamera(camera);
  xrCam.cameras.forEach((cam, i) => {
    cam.layers.enable(0);
    if (i === 0) cam.layers.enable(1);
    if (i === 1) cam.layers.enable(2);
  });

  // Controllers
  const ua = navigator.userAgent;
  if (/OculusBrowser|Quest/.test(ua)) {
    try {
      console.log('Meta Quest detectado → inicializando quest.js');
      initQuestControllers({ renderer, scene, referenceSpace });
    } catch (err) {
      console.error('❌ Quest controllers falhou:', err);
      console.log('Fallback genérico → inicializando generic_vr.js');
      initGenericControllers({ renderer, scene, referenceSpace });
    }
  } else {
    console.log('Dispositivo genérico → inicializando generic_vr.js');
    initGenericControllers({ renderer, scene, referenceSpace });
  }

  // Render Loop
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

/**
 * Loads a 360° image ou video (mono/stereo) na cena.
 */
export async function load(media) {
  console.log('Carregando mídia:', media.name);

  // Remove old
  [monoMesh, leftMesh, rightMesh].forEach(m => {
    if (m) {
      scene.remove(m);
      m.geometry.dispose();
      m.material.map.dispose();
      m.material.dispose();
    }
  });
  monoMesh = leftMesh = rightMesh = null;
  if (videoElement) {
    videoElement.pause();
    videoElement.remove();
    videoElement = null;
  }

  // Texture
  if (media.type === 'video') {
    videoElement = document.createElement('video');
    Object.assign(videoElement, {
      src:         media.cachePath || media.src,
      loop:        true,
      muted:       true,
      playsInline: true
    });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    texture = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(
        media.cachePath || media.src,
        res,
        undefined,
        rej
      )
    );
  }

  // Configurações de qualidade
  texture.mapping         = THREE.EquirectangularReflectionMapping;
  texture.colorSpace      = THREE.SRGBColorSpace;
  texture.wrapS           = THREE.ClampToEdgeWrapping;
  texture.wrapT           = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter       = THREE.LinearMipMapLinearFilter;
  texture.magFilter       = THREE.LinearFilter;
  texture.anisotropy      = renderer.capabilities.getMaxAnisotropy();

  const geo = new THREE.SphereGeometry(500, 256, 128);
  geo.scale(-1, 1, 1);

  if (media.stereo) {
    const leftTex = texture.clone();
    leftTex.repeat.set(1, 0.5);
    leftTex.offset.set(0, 0.5);
    leftTex.needsUpdate = true;
    leftMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: leftTex }));
    leftMesh.layers.set(1);
    scene.add(leftMesh);

    const rightTex = texture.clone();
    rightTex.repeat.set(1, 0.5);
    rightTex.offset.set(0, 0);
    rightTex.needsUpdate = true;
    rightMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rightTex }));
    rightMesh.layers.set(2);
    scene.add(rightMesh);
  } else {
    monoMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
    monoMesh.layers.set(0);
    scene.add(monoMesh);
  }
}