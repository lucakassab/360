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
  mediaList = await (await fetch('./media/media.json')).json();
  console.log('mediaList:', mediaList);

  // 2) preenche dropdown
  mediaList.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value = i; o.textContent = m.name;
    dropdown.appendChild(o);
  });

  // 3) importa desktop e vr
  [desktopMod, vrMod] = await Promise.all([
    import('./platforms/desktop.js'),
    import('./platforms/vr.js')
  ]);

  // 4) começa no desktop
  currentModule = desktopMod;
  await loadMedia(currentIndex);

  // 5) se WebXR, cria botão e bind no click
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    console.log('WebXR ok, inicializando XR renderer');
    await vrMod.initXR();

    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(vrMod.renderer);
    // antes de entrar na sessão, carrega a cena VR
    btn.addEventListener('click', async () => {
      console.log('← click ENTER VR: carregando cena VR');
      currentModule = vrMod;
      await vrMod.load(mediaList[currentIndex]);
      console.log('← cena VR pronta, agora entra na sessão');
      // a própria VRButton cuidará de chamar requestSession()
    });
    document.body.appendChild(btn);
  }

  // 6) UI listeners
  dropdown.onchange = e=>{
    currentIndex = +e.target.value;
    loadMedia(currentIndex);
  };
  btnPrev.onclick = ()=>{
    currentIndex = (currentIndex-1+mediaList.length)%mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };
  btnNext.onclick = ()=>{
    currentIndex = (currentIndex+1)%mediaList.length;
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };

  showLoading(false);
}

async function loadMedia(idx) {
  showLoading(true);
  try {
    await currentModule.load(mediaList[idx]);
  } catch(err) {
    console.error('erro loadMedia:', err);
  }
  showLoading(false);
}

function showLoading(v) {
  loadingEl.style.display = v ? 'block' : 'none';
}
