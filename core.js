// core.js
const canvas = document.getElementById('xr-canvas');
const loadingEl = document.getElementById('loading');
const dropdown = document.getElementById('mediaSelect');
const btnPrev = document.getElementById('prevBtn');
const btnNext = document.getElementById('nextBtn');

let mediaList = [];
let currentIndex = 0;
let currentModule = null;

main();

async function main() {
  showLoading(true);

  // 1) Carrega a lista de mídia
  const response = await fetch('./media/media.json');
  mediaList = await response.json();

  // 2) Preenche o dropdown
  mediaList.forEach((item, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = item.name;
    dropdown.appendChild(opt);
  });

  // 3) Detecta plataforma e importa o módulo certo
  currentModule = await detectPlatform();

  // 4) Carrega a primeira mídia
  await loadMedia(currentIndex);

  // 5) Listeners
  dropdown.addEventListener('change', e => {
    currentIndex = parseInt(e.target.value);
    loadMedia(currentIndex);
  });
  btnPrev.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  });
  btnNext.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  });
}

async function detectPlatform() {
  // **Modo VR** em qualquer dispositivo que suporte immersive-vr
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const mod = await import('./platforms/vr.js');
    return mod;
  }
  // **Mobile** (sem VR)
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const mod = await import('./platforms/mobile.js');
    return mod;
  }
  // **Desktop** normal
  const mod = await import('./platforms/desktop.js');
  return mod;
}

async function loadMedia(index) {
  showLoading(true);
  const media = mediaList[index];
  await currentModule.load(media);
  showLoading(false);
}

function showLoading(state) {
  loadingEl.style.display = state ? 'block' : 'none';
}
