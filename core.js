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

  // 2) Detecta plataforma e importa SOMENTE um módulo
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    platformMod = await import('./platforms/mobile.js');
  } else {
    platformMod = await import('./platforms/desktop.js');
  }
  await platformMod.init();
  currentModule = platformMod;

  // 3) Carrega a primeira mídia
  await loadMedia(currentIndex);

  // 4) Se suportar WebXR, adiciona botão e eventos de sessão
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const renderer = platformMod.renderer;
    renderer.xr.enabled = true;

    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(renderer);
    document.body.appendChild(btn);

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend',   onSessionEnd);
  }

  // 5) UI listeners
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

// Chamado quando entra em VR
async function onSessionStart() {
  console.log('🌐 VR session started');
  const vrMod = await import('./platforms/vr.js');
  // inicializa VR com o renderer atual
  await vrMod.initXR(platformMod.renderer);
  currentModule = vrMod;
  await vrMod.load(mediaList[currentIndex]);

  // configura botões A/B do Quest para avançar/voltar
  setupVRInputs(
    platformMod.renderer,
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

// Chamado quando sai de VR
async function onSessionEnd() {
  console.log('🌐 VR session ended');
  // volta pro módulo original (desktop ou mobile)
  currentModule = platformMod;
  // recarrega a cena no modo não-VR
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