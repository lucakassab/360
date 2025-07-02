// core.js

import { setupVRInputs } from './platforms/vr_inputs.js';

const loadingEl  = document.getElementById('loading');
const dropdown   = document.getElementById('mediaSelect');
const btnPrev    = document.getElementById('prevBtn');
const btnNext    = document.getElementById('nextBtn');

let mediaList    = [];
let currentIndex = 0;
let currentModule;
let platformMod;

main();

async function main() {
  // 1) Carrega lista de mídia
  mediaList = await (await fetch('./media/media.json')).json();
  mediaList.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = m.name;
    dropdown.appendChild(opt);
  });

  // 2) Detecta plataforma e importa só 1 módulo
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    platformMod = await import('./platforms/mobile.js');
  } else {
    platformMod = await import('./platforms/desktop.js');
  }
  await platformMod.init();
  currentModule = platformMod;

  // 3) Carrega a primeira mídia
  await loadMedia(currentIndex);

  // 4) Se suportar WebXR, adiciona botão VR
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const renderer = platformMod.renderer;
    renderer.xr.enabled = true;

    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(renderer);
    document.body.appendChild(btn);

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend',   onSessionEnd);
  }

  // 5) Listeners UI
  dropdown.onchange = e => {
    currentIndex = +e.target.value;
    loadMedia(currentIndex);
  };
  btnPrev.onclick = () => {
    currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };
  btnNext.onclick = () => {
    currentIndex = (currentIndex + 1) % mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };
}

// Quando começa a sessão VR
async function onSessionStart() {
  console.log('🌐 VR session started');
  const vrMod = await import('./platforms/vr.js');
  // Inicializa XR no mesmo canvas/renderer
  await vrMod.initXR(platformMod.renderer);
  currentModule = vrMod;
  await vrMod.load(mediaList[currentIndex]);

  // ⚠️ Aqui o fix: passa vrMod.renderer, não platformMod.renderer
  setupVRInputs(
    vrMod.renderer,
    () => {
      currentIndex = (currentIndex + 1) % mediaList.length;
      dropdown.value = currentIndex;
      vrMod.load(mediaList[currentIndex]);
    },
    () => {
      currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
      dropdown.value = currentIndex;
      vrMod.load(mediaList[currentIndex]);
    }
  );
}

// Quando sai da sessão VR
async function onSessionEnd() {
  console.log('🌐 VR session ended');
  currentModule = platformMod;
  await loadMedia(currentIndex);
}

async function loadMedia(idx) {
  loadingEl.style.display = 'block';
  try {
    await currentModule.load(mediaList[idx]);
  } catch (err) {
    console.error('erro loadMedia:', err);
  }
  loadingEl.style.display = 'none';
}
