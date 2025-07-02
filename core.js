// core.js

const canvas     = document.getElementById('xr-canvas');
const loadingEl  = document.getElementById('loading');
const dropdown   = document.getElementById('mediaSelect');
const btnPrev    = document.getElementById('prevBtn');
const btnNext    = document.getElementById('nextBtn');

let mediaList    = [];
let currentIndex = 0;
let currentModule;

let desktopMod, mobileMod;

main();

async function main() {
  // 1) lista de mídia
  mediaList = await (await fetch('./media/media.json')).json();

  // 2) dropdown
  mediaList.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value = i; o.textContent = m.name;
    dropdown.appendChild(o);
  });

  // 3) importa apenas desktop e mobile
  [desktopMod, mobileMod] = await Promise.all([
    import('./platforms/desktop.js'),
    import('./platforms/mobile.js')
  ]);

  // 4) escolhe mobile vs desktop
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    currentModule = mobileMod;
  } else {
    currentModule = desktopMod;
  }

  // 5) carrega primeira mídia
  await loadMedia(currentIndex);

  // 6) se WebXR suportado, mostra o VR Button
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const { VRButton } = await import('./libs/VRButton.js');
    // usa o mesmo renderer do desktopMod pra criar o botão
    const renderer = desktopMod.renderer;
    renderer.xr.enabled = true;
    const btn = VRButton.createButton(renderer);
    btn.addEventListener('click', onEnterVR);
    document.body.appendChild(btn);
  }

  // 7) UI listeners
  dropdown.onchange = () => loadMedia(currentIndex = +dropdown.value);
  btnPrev.onclick = () => loadMedia(currentIndex = (currentIndex-1+mediaList.length)%mediaList.length);
  btnNext.onclick = () => loadMedia(currentIndex = (currentIndex+1)%mediaList.length);
}

async function onEnterVR() {
  // 8) só aqui importa e inicia o VR
  const vrMod = await import('./platforms/vr.js');
  currentModule = vrMod;
  // passa o renderer que já existia no desktopMod
  await vrMod.initXR(desktopMod.renderer);
  await vrMod.load(mediaList[currentIndex]);
}

async function loadMedia(idx) {
  loadingEl.style.display = 'block';
  try {
    await currentModule.load(mediaList[idx]);
  } catch(e) {
    console.error('erro loadMedia:', e);
  }
  loadingEl.style.display = 'none';
}
