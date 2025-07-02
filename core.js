const canvas     = document.getElementById('xr-canvas');
const loadingEl  = document.getElementById('loading');
const dropdown   = document.getElementById('mediaSelect');
const btnPrev    = document.getElementById('prevBtn');
const btnNext    = document.getElementById('nextBtn');

let mediaList     = [];
let currentIndex  = 0;
let currentModule = null;

main();

async function main() {
  showLoading(true);

  // 1) carrega JSON
  const resp = await fetch('./media/media.json');
  mediaList = await resp.json();

  // 2) preenche dropdown
  mediaList.forEach((item,i)=> {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = item.name;
    dropdown.appendChild(opt);
  });

  // 3) detecta e importa plataforma
  currentModule = await importPlatform();

  // 4) carrega primeira mídia
  await loadMedia(currentIndex);

  // 5) listeners
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

  showLoading(false);
}

async function importPlatform() {
  // WEBXR suportado? só mostra o botão, continua no desktop até clicar
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const mod = await import('./platforms/desktop.js');
    // habilita XR no renderer exportado
    mod.renderer.xr.enabled = true;

    // cria e injeta o botão VR
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(mod.renderer);
    document.body.appendChild(btn);

    // quando clicar, troca pra vr.js e recarrega a mídia atual
    btn.addEventListener('click', async () => {
      const vrMod = await import('./platforms/vr.js');
      currentModule = vrMod;
      await vrMod.load(mediaList[currentIndex]);
    });

    return mod;
  }

  // mobile ou desktop normal
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    return await import('./platforms/mobile.js');
  } else {
    return await import('./platforms/desktop.js');
  }
}

async function loadMedia(i) {
  showLoading(true);
  await currentModule.load(mediaList[i]);
  showLoading(false);
}

function showLoading(v) {
  loadingEl.style.display = v ? 'block' : 'none';
}
