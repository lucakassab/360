// core.js

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
  // 1) carrega lista
  mediaList = await (await fetch('./media/media.json')).json();
  mediaList.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value = i; o.textContent = m.name;
    dropdown.appendChild(o);
  });

  // 2) detecta e importa só 1 módulo
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    platformMod = await import('./platforms/mobile.js');
  } else {
    platformMod = await import('./platforms/desktop.js');
  }
  await platformMod.init();
  currentModule = platformMod;

  // 3) carrega mídia inicial
  await loadMedia(currentIndex);

  // 4) VR button (desktop ou mobile): pega renderer do platformMod
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const renderer = platformMod.renderer;
    renderer.xr.enabled = true;
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(renderer);
    btn.addEventListener('click', onEnterVR);
    document.body.appendChild(btn);
  }

  // 5) listeners UI
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

async function onEnterVR() {
  // importa e inicializa VR só no clique
  const vrMod = await import('./platforms/vr.js');
  await vrMod.initXR(platformMod.renderer);
  currentModule = vrMod;
  await vrMod.load(mediaList[currentIndex]);
}

async function loadMedia(idx) {
  loadingEl.style.display = 'block';
  try {
    await currentModule.load(mediaList[idx]);
  } catch(err) {
    console.error('erro loadMedia:', err);
  }
  loadingEl.style.display = 'none';
}
