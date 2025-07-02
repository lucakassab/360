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

  // Carrega JSON da mídia
  const response = await fetch('./media/media.json');
  mediaList = await response.json();

  // Preenche dropdown
  mediaList.forEach((item, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = item.name;
    dropdown.appendChild(opt);
  });

  // Detecta e importa módulo de plataforma
  currentModule = await detectPlatform();

  // Inicializa cena com primeira mídia
  await loadMedia(currentIndex);

  // Event Listeners
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
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Oculus") || userAgent.includes("Quest")) {
      const mod = await import('./platforms/vr.js');
      return mod;
    }
  }

  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const mod = await import('./platforms/mobile.js');
    return mod;
  }

  const mod = await import('./platforms/desktop.js');
  return mod;
}

async function loadMedia(index) {
  showLoading(true);

  const media = mediaList[index];
  await currentModule.load(media); // Cada módulo implementa isso

  showLoading(false);
}

function showLoading(state) {
  loadingEl.style.display = state ? 'block' : 'none';
}
