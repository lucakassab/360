import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

export let renderer;
let scene, camera, controls, sphereMesh, videoElement, texture;
const videoBlobMap = {};
const DEBUG = false;
const debugLogs = [];

// Função de log
function log(...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
  debugLogs.push(msg);
  console.debug(msg);
  if (DEBUG) {
    const dbg = document.getElementById('debug-log');
    if (dbg) {
      const div = document.createElement('div');
      div.textContent = msg;
      dbg.appendChild(div);
      dbg.scrollTop = dbg.scrollHeight;
    }
  }
}

export async function init({ container }) {
  container.innerHTML = '';

  // Debug overlay
  if (DEBUG) {
    const dbg = document.createElement('div');
    dbg.id = 'debug-log';
    Object.assign(dbg.style, {
      position: 'absolute',
      bottom: '50px',
      left: '0',
      width: '100%',
      maxHeight: '30%',
      overflowY: 'auto',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: '9999'
    });
    container.appendChild(dbg);

    const btn = document.createElement('button');
    btn.textContent = '📥 Download Logs';
    Object.assign(btn.style, {
      position: 'absolute',
      bottom: '0',
      right: '10px',
      padding: '8px 12px',
      fontSize: '14px',
      zIndex: '10000'
    });
    btn.onclick = () => {
      const blob = new Blob([debugLogs.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'desktop-debug-log.txt';
      a.click();
      URL.revokeObjectURL(url);
    };
    container.appendChild(btn);

    log('Debug mode ativado (desktop)');
  }

  log('=== DESKTOP ENVIRONMENT ===');
  log('User Agent:', navigator.userAgent);
  if (navigator.userAgentData) log('UA Data:', JSON.stringify(navigator.userAgentData));
  log('Platform:', navigator.platform);
  log(`Screen: ${screen.width}x${screen.height} @ DPR ${window.devicePixelRatio}`);
  log('Hardware Concurrency:', navigator.hardwareConcurrency);
  log('Device Memory (GB):', navigator.deviceMemory || 'unknown');

  // Setup Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  // Performance: DPR fixo em 1
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enablePan = false;

  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });

  animate();
}

export async function load(media) {
  log('Carregando mídia', media.name);
  if (sphereMesh) {
    scene.remove(sphereMesh);
    sphereMesh.geometry.dispose();
    sphereMesh.material.map.dispose();
    sphereMesh.material.dispose();
    sphereMesh = null;
  }
  if (videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement.load();
    videoElement = null;
  }

  if (media.type === 'video') {
    const srcUrl = media.cachePath || media.src;
    if (!videoBlobMap[srcUrl]) {
      const response = await fetch(srcUrl);
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      videoBlobMap[srcUrl] = URL.createObjectURL(blob);
    }

    videoElement = document.createElement('video');
    Object.assign(videoElement, {
      src: videoBlobMap[srcUrl],
      loop: true,
      muted: true,
      playsInline: true,
      preload: 'auto'
    });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
    // Vídeo: desativa mipmaps para performance
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  } else {
    texture = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(media.cachePath || media.src, res, undefined, rej)
    );
    // Imagens: mantém mipmaps para qualidade
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if (media.stereo) {
    log('Stereo mode');
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0.5);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  const geo = new THREE.SphereGeometry(500, 64, 32);
  geo.scale(-1, 1, 1);
  sphereMesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: texture })
  );
  scene.add(sphereMesh);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Injeta logs vindos do VR (se houver)
export function appendLogs(vrLogs) {
  vrLogs.forEach(msg => log(msg));
}
