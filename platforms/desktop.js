// platforms/desktop.js
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

export let renderer;
let scene, camera, controls, sphereMesh, videoElement, texture;

// Cache de vídeos carregados como Blob URLs para evitar múltiplas requisições
const videoBlobMap = {};

export async function init({ container }) {
  container.innerHTML = '';

  // Three.js setup
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
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
  // Remove mesh existente
  if (sphereMesh) {
    scene.remove(sphereMesh);
    sphereMesh.geometry.dispose();
    sphereMesh.material.map.dispose();
    sphereMesh.material.dispose();
    sphereMesh = null;
  }
  // Para vídeo anterior
  if (videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement.load();
    videoElement = null;
  }

  if (media.type === 'video') {
    // Determina URL de cache
    const srcUrl = media.cachePath || media.src;

    // Se ainda não carregado, busca e armazena Blob URL
    if (!videoBlobMap[srcUrl]) {
      const response = await fetch(srcUrl);
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      videoBlobMap[srcUrl] = URL.createObjectURL(blob);
    }

    // Cria elemento de vídeo com Blob URL
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
  } else {
    // Carrega imagem
    texture = await new Promise((res, rej) =>
      new THREE.TextureLoader().load(
        media.cachePath || media.src,
        res,
        undefined,
        rej
      )
    );
  }

  // Configurações comuns de textura
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAniso;

  // Estéreo: usa metade superior
  if (media.stereo) {
    texture.repeat.set(1, 0.5);
    texture.offset.set(0, 0.5);
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }
  texture.needsUpdate = true;

  // Cria mesh de esfera
  const geo = new THREE.SphereGeometry(500, 128, 64);
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

// Anexa logs de VR (se necessário)
export function appendLogs(vrLogs) {
  vrLogs.forEach(msg => console.log(msg));
}