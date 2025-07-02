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

  // 3) UI listeners (HTML buttons)
  dropdown.onchange = () => {
    currentIndex = +dropdown.value;
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

  // 4) Carrega a primeira mídia
  await loadMedia(currentIndex);

  // 5) Se suportar WebXR, adiciona botão VR e eventos
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const renderer = platformMod.renderer;
    renderer.xr.enabled = true;

    const { VRButton } = await import('./libs/VRButton.js');
    const vrBtn = VRButton.createButton(renderer);
    document.body.appendChild(vrBtn);

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend',   onSessionEnd);
  }
}

// Quando entra em VR
async function onSessionStart() {
  console.log('🌐 VR session started');
  const vrMod = await import('./platforms/vr.js');
  // Inicializa XR (reusa o mesmo renderer)
  await vrMod.initXR(platformMod.renderer);
  currentModule = vrMod;
  await vrMod.load(mediaList[currentIndex]);

  // ⚠️ FIX: usa vrMod.renderer aqui e dispara os clicks dos botões HTML
  setupVRInputs(
    vrMod.renderer,
    () => btnNext.click(), // avança
    () => btnPrev.click()  // volta
  );
}

// Quando sai do VR
async function onSessionEnd() {
  console.log('🌐 VR session ended');
  currentModule = platformMod;
  await loadMedia(currentIndex);
}

// Função genérica de carregar mídia (desktop/mobile/VR)
async function loadMedia(idx) {
  loadingEl.style.display = 'block';
  try {
    await currentModule.load(mediaList[idx]);
  } catch (err) {
    console.error('erro loadMedia:', err);
  }
  loadingEl.style.display = 'none';
}
