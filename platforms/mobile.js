// platforms/mobile.js
import * as THREE from '../libs/three.module.js';

const DEBUG = false;
let scene, camera, renderer, sphereMesh, videoElement, texture;
const touchState = { isDragging: false, prevX: 0, prevY: 0, prevDist: 0 };
const debugLogs = [];

// Função de log que alimenta console, array e overlay
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
  // Canvas full-screen
  const canvas = document.createElement('canvas');
  canvas.id = 'xr-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.innerHTML = '';
  container.appendChild(canvas);

  // Overlay de debug
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
      a.download = 'debug-log.txt';
      a.click();
      URL.revokeObjectURL(url);
    };
    container.appendChild(btn);

    log('Debug mode ativado');
  }

  // Info ambiente
  log('=== MOBILE ENVIRONMENT ===');
  log('User Agent: ' + navigator.userAgent);
  if (navigator.userAgentData) log('UA Data: ' + JSON.stringify(navigator.userAgentData));
  log('Platform: ' + navigator.platform);
  log(`Screen: ${screen.width}x${screen.height} @ DPR ${window.devicePixelRatio}`);
  log('Hardware Concurrency: ' + navigator.hardwareConcurrency);
  log('Device Memory (GB): ' + (navigator.deviceMemory || 'unknown'));
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr')
      .then(s => log('Supports immersive-vr: ' + s))
      .catch(() => log('Error checking immersive-vr support'));
    navigator.xr.isSessionSupported('inline')
      .then(s => log('Supports inline: ' + s))
      .catch(() => log('Error checking inline support'));
  } else {
    log('navigator.xr not available');
  }

  log('Loaded: platforms/mobile.js');
  log('Loaded: libs/three.module.js');

  // Cena e câmera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(0, 0, 0.1);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  setupTouchControls(canvas);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  animate();
}

function setupTouchControls(canvas) {
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
}

function onTouchStart(e) {
  log('touchstart', e.touches.length);
  if (e.touches.length === 1) {
    touchState.isDragging = true;
    touchState.prevX = e.touches[0].pageX;
    touchState.prevY = e.touches[0].pageY;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].pageX - e.touches[1].pageX;
    const dy = e.touches[0].pageY - e.touches[1].pageY;
    touchState.prevDist = Math.hypot(dx, dy);
  }
}

function onTouchMove(e) {
  e.preventDefault();
  log('touchmove', e.touches.length);
  if (e.touches.length === 1 && touchState.isDragging && sphereMesh) {
    const dx = e.touches[0].pageX - touchState.prevX;
    const dy = e.touches[0].pageY - touchState.prevY;
    touchState.prevX = e.touches[0].pageX;
    touchState.prevY = e.touches[0].pageY;
    sphereMesh.rotation.y += dx * 0.005;
    sphereMesh.rotation.x += dy * 0.005;
    sphereMesh.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, sphereMesh.rotation.x));
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].pageX - e.touches[1].pageX;
    const dy = e.touches[0].pageY - e.touches[1].pageY;
    const dist = Math.hypot(dx, dy);
    const delta = (touchState.prevDist - dist) * 0.05;
    camera.fov = THREE.MathUtils.clamp(camera.fov + delta, 30, 100);
    camera.updateProjectionMatrix();
    touchState.prevDist = dist;
  }
}

function onTouchEnd(e) {
  log('touchend', e.touches.length);
  if (e.touches.length === 0) touchState.isDragging = false;
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
    videoElement.remove();
    videoElement = null;
  }

  if (media.type === 'video') {
    videoElement = document.createElement('video');
    Object.assign(videoElement, {
      src: media.cachePath || media.src,
      loop: true,
      muted: true,
      playsInline: true
    });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    texture = await new Promise((res, rej) => {
      new THREE.TextureLoader().load(media.cachePath || media.src, res, undefined, rej);
    });
  }

  log('Configuring texture');
  texture.mapping         = THREE.EquirectangularReflectionMapping;
  texture.colorSpace      = THREE.SRGBColorSpace;
  texture.wrapS           = THREE.ClampToEdgeWrapping;
  texture.wrapT           = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter       = THREE.LinearMipMapLinearFilter;
  texture.magFilter       = THREE.LinearFilter;
  texture.anisotropy      = renderer.capabilities.getMaxAnisotropy();

  if (media.stereo) {
    log('Stereo mode');
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0.5);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  const geo = new THREE.SphereGeometry(500, 256, 128);
  geo.scale(-1, 1, 1);
  sphereMesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: texture })
  );
  scene.add(sphereMesh);
  log('Mídia adicionada à cena');
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Injeta logs vindos do modo VR
export function appendLogs(vrLogs) {
  vrLogs.forEach(msg => log(msg));
}
