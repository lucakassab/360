// core.js
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

  // 3) detecta e importa desktop/mobile
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
  // Se WebXR suportado, usamos desktop.js + mostramos botão VR
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const mod = await import('./platforms/desktop.js');
    // habilita XR no renderer
    mod.renderer.xr.enabled = true;

    // carrega só o VRButton.js pra mostrar o botão
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(mod.renderer);
    // wrap no onclick: só importamos vr.js quando apertar
    const oldClick = btn.onclick;
    btn.onclick = async () => {
      // importa vr.js e troca o módulo
      const vrMod = await import('./platforms/vr.js');
      currentModule = vrMod;
      await vrMod.load(mediaList[currentIndex]);
      // depois que já carregou o modo VR, chama o handler original pra setSession
      oldClick();
    };
    document.body.appendChild(btn);

    return mod;
  }

  // senão: mobile ou desktop normal
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const mod = await import('./platforms/mobile.js');
    return mod;
  } else {
    const mod = await import('./platforms/desktop.js');
    return mod;
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
