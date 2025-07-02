// core.js

// === DEBUG FLAG ===
const DEBUG = true;
if (DEBUG) {
  const dump = document.createElement('div');
  Object.assign(dump.style, {
    position: 'fixed',
    bottom: '0', left: '0',
    width: '100%', maxHeight: '200px',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.8)',
    color: '#0f0', font: '12px monospace',
    zIndex: '9999', padding: '4px'
  });
  document.body.appendChild(dump);
  ['log','info','warn','error'].forEach(level=>{
    const orig = console[level];
    console[level] = (...args)=>{
      orig.apply(console,args);
      const line = document.createElement('div');
      line.textContent = `[${level}] `+args.map(a=>typeof a==='object'?JSON.stringify(a):a).join(' ');
      dump.appendChild(line);
      dump.scrollTop = dump.scrollHeight;
    };
  });
}

const canvas     = document.getElementById('xr-canvas');
const loadingEl  = document.getElementById('loading');
const dropdown   = document.getElementById('mediaSelect');
const btnPrev    = document.getElementById('prevBtn');
const btnNext    = document.getElementById('nextBtn');

let mediaList    = [], currentIndex = 0, currentModule = null;
let desktopMod, vrMod;

main();

async function main() {
  console.log('main() start');
  showLoading(true);

  // 1) carrega lista
  console.log('fetching media.json');
  mediaList = await (await fetch('./media/media.json')).json();
  console.log('mediaList:', mediaList);

  // 2) preenche dropdown
  mediaList.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value = i; o.textContent = m.name;
    dropdown.appendChild(o);
  });
  console.log('dropdown ready');

  // 3) importa desktop e vr js
  console.log('importing modules');
  [desktopMod, vrMod] = await Promise.all([
    import('./platforms/desktop.js'),
    import('./platforms/vr.js')
  ]);
  console.log('modules loaded');

  // 4) start no desktop
  currentModule = desktopMod;
  console.log('loading first media on desktop');
  await loadMedia(currentIndex);

  // 5) se WebXR, prepara botão com override do click
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    console.log('WebXR ok → initXR');
    await vrMod.initXR(); // prepara renderer.xr
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(vrMod.renderer);
    document.body.appendChild(btn);
    console.log('VRButton appended');

    // override do click: carrega VR antes de entrar na session
    const origClick = btn.onclick;
    btn.onclick = async () => {
      console.log('▶ Enter VR clicked: loading VR media first');
      currentModule = vrMod;
      await vrMod.load(mediaList[currentIndex]);
      console.log('▶ VR media loaded, now starting session');
      origClick();
    };
  } else {
    console.log('WebXR não suportado aqui');
  }

  // 6) UI listeners
  dropdown.onchange = e=>{
    currentIndex = +e.target.value;
    console.log('dropdown ->', currentIndex);
    loadMedia(currentIndex);
  };
  btnPrev.onclick = ()=>{
    currentIndex = (currentIndex-1+mediaList.length)%mediaList.length;
    console.log('prev ->', currentIndex);
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };
  btnNext.onclick = ()=>{
    currentIndex = (currentIndex+1)%mediaList.length;
    console.log('next ->', currentIndex);
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };

  showLoading(false);
  console.log('main() done');
}

async function loadMedia(idx) {
  console.log('loadMedia idx=', idx);
  showLoading(true);
  try {
    await currentModule.load(mediaList[idx]);
    console.log('media carregada!');
  } catch(err) {
    console.error('erro loadMedia:', err);
  }
  showLoading(false);
}

function showLoading(v) {
  loadingEl.style.display = v ? 'block' : 'none';
}
