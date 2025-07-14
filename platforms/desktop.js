// platforms/desktop.js
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

export let renderer;
let scene, camera, controls, sphereMesh, videoElement, texture;

const DEBUG_DESKTOP = true;
const desktopLogs = [];

// Log helper
function desktopLog(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  console.log(msg);
  if (DEBUG_DESKTOP) {
    desktopLogs.push(msg);
    const dbg = document.getElementById('desktop-debug-log');
    if (dbg) {
      const line = document.createElement('div');
      line.textContent = msg;
      dbg.appendChild(line);
      dbg.scrollTop = dbg.scrollHeight;
    }
  }
}

export async function init({ container }) {
  container.innerHTML = '';

  // Debug overlay
  if (DEBUG_DESKTOP) {
    const dbg = document.createElement('div');
    dbg.id = 'desktop-debug-log';
    Object.assign(dbg.style, {
      position: 'absolute', top: '0', right: '0',
      width: '300px', maxHeight: '40%', overflowY: 'auto',
      backgroundColor: 'rgba(0,0,0,0.7)', color: '#0f0',
      fontSize: '12px', fontFamily: 'monospace', zIndex: 9999, padding: '8px'
    });
    container.appendChild(dbg);

    const btn = document.createElement('button');
    btn.textContent = 'Download Logs';
    Object.assign(btn.style, { position: 'absolute', top: '0', right: '310px', zIndex: 10000 });
    btn.onclick = () => {
      const blob = new Blob([desktopLogs.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'desktop-debug-log.txt'; a.click();
      URL.revokeObjectURL(url);
    };
    container.appendChild(btn);

    desktopLog('Desktop DEBUG mode ativado');
  }
  desktopLog('Loaded: platforms/desktop.js');

  // Three.js setup
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

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
  desktopLog('--- Loading Media ---');
  desktopLog('Name:', media.name, 'Type:', media.type, 'Stereo:', media.stereo);

  // cleanup old
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

  // Prepare texture or video
  if (media.type === 'video') {
    desktopLog('Fetching full video as blob to avoid range requests...');
    // Fetch full video once
    const response = await fetch(media.cachePath || media.src);
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    videoElement = document.createElement('video');
    Object.assign(videoElement, { src: blobUrl, loop: true, muted: true, playsInline: true });
    await videoElement.play();
    texture = new THREE.VideoTexture(videoElement);
  } else {
    texture = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(media.cachePath || media.src, res, undefined, rej)
    );
  }

  // Common texture settings
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAniso;

  // Stereo: exibir só metade superior ( olho esquerdo )
  if (media.stereo) {
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0.5);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  // Create sphere mesh
  const geo = new THREE.SphereGeometry(500, 128, 64);
  geo.scale(-1, 1, 1);
  sphereMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(sphereMesh);

  desktopLog('Media adicionada à cena');
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Append VR logs to desktop
export function appendLogs(vrLogs) {
  vrLogs.forEach(msg => desktopLog(msg));
}
