// core.js

const canvas     = document.getElementById('xr-canvas');
const loadingEl  = document.getElementById('loading');
const dropdown   = document.getElementById('mediaSelect');
const btnPrev    = document.getElementById('prevBtn');
const btnNext    = document.getElementById('nextBtn');

let mediaList    = [];
let currentIndex = 0;
let currentModule;

main();

async function main() {
  // 1) carrega JSON
  mediaList = await (await fetch('./media/media.json')).json();
  mediaList.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value = i; o.textContent = m.name;
    dropdown.appendChild(o);
  });

  // 2) detecta plataforma e importa só 1 módulo
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const mobileMod = await import('./platforms/mobile.js');
    await mobileMod.init();
    currentModule = mobileMod;
  } else {
    const desktopMod = await import('./platforms/desktop.js');
    await desktopMod.init();
    currentModule = desktopMod;
  }

  // 3) carrega a mídia inicial
  await loadMedia(currentIndex);

  // 4) se WebXR, monta o botão VR usando o mesmo renderer do desktopMod
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    // só desktopMod tem renderer, mobileMod nem precisa VR
    const { renderer } = await import('./platforms/desktop.js');
    renderer.xr.enabled = true;
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(renderer);
    btn.addEventListener('click', onEnterVR);
    document.body.appendChild(btn);
  }

  // 5) UI
  dropdown.onchange = () => loadMedia(currentIndex = +dropdown.value);
  btnPrev.onclick = () => loadMedia(currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length);
  btnNext.onclick = () => loadMedia(currentIndex = (currentIndex + 1) % mediaList.length);
}

async function onEnterVR() {
  // 6) import e inicializa VR SÓ no click
  const vrMod = await import('./platforms/vr.js');
  currentModule = vrMod;
  // passa o desktop renderer
  const { renderer } = await import('./platforms/desktop.js');
  await vrMod.initXR(renderer);
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
