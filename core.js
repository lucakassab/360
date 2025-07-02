// core.js

// === DEBUG FLAG ===
const DEBUG = true;

// Backup dos métodos originais
const _console = {
  log:   console.log,
  info:  console.info,
  warn:  console.warn,
  error: console.error
};

if (DEBUG) {
  // Cria a área de debug no DOM
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-console';
  Object.assign(debugDiv.style, {
    position:      'fixed',
    bottom:        '0',
    left:          '0',
    width:         '100%',
    maxHeight:     '200px',
    overflowY:     'auto',
    background:    'rgba(0,0,0,0.8)',
    color:         '#0f0',
    fontSize:      '12px',
    fontFamily:    'monospace',
    zIndex:        '9999',
    padding:       '4px'
  });
  document.body.appendChild(debugDiv);

  // Sobrescreve console methods
  ['log', 'info', 'warn', 'error'].forEach(level => {
    console[level] = function(...args) {
      // Chama o console original
      _console[level].apply(console, args);

      // Formata mensagem
      const msg = args.map(a =>
        (typeof a === 'object' ? JSON.stringify(a) : String(a))
      ).join(' ');

      // Adiciona no debugDiv
      const line = document.createElement('div');
      line.textContent = `[${level}] ${msg}`;
      debugDiv.appendChild(line);
      debugDiv.scrollTop = debugDiv.scrollHeight;
    };
  });
}

// === ELEMENTOS PRINCIPAIS ===
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
  console.log('main() iniciado');

  showLoading(true);

  // 1) carrega JSON de mídia
  console.log('fetch media.json');
  const resp = await fetch('./media/media.json');
  mediaList = await resp.json();
  console.log('mediaList:', mediaList);

  // 2) preenche dropdown
  mediaList.forEach((item, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = item.name;
    dropdown.appendChild(opt);
  });
  console.log('dropdown populado');

  // 3) importa módulos desktop e vr em paralelo
  console.log('importando desktop e vr modules...');
  const [desktopMod, vrMod] = await Promise.all([
    import('./platforms/desktop.js'),
    import('./platforms/vr.js')
  ]);
  console.log('modules importados:', desktopMod, vrMod);

  // 4) inicializa desktop
  currentModule = desktopMod;
  console.log('carregando primeira mídia no desktop');
  await loadMedia(currentIndex);

  // 5) configura VRButton se suportado
  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    console.log('WebXR suportado! inicializando XR renderer...');
    await vrMod.initXR();
    const { VRButton } = await import('./libs/VRButton.js');
    const btn = VRButton.createButton(vrMod.renderer);
    document.body.appendChild(btn);
    console.log('VRButton adicionado');

    btn.addEventListener('click', async () => {
      console.log('clicou ENTER VR, trocando para vrMod');
      currentModule = vrMod;
      await vrMod.load(mediaList[currentIndex]);
    });
  } else {
    console.log('WebXR NÃO suportado neste device.');
  }

  // 6) listeners UI
  dropdown.onchange = e => {
    currentIndex = +e.target.value;
    console.log('dropdown change', currentIndex);
    loadMedia(currentIndex);
  };
  btnPrev.onclick = () => {
    currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    console.log('prev click', currentIndex);
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };
  btnNext.onclick = () => {
    currentIndex = (currentIndex + 1) % mediaList.length;
    console.log('next click', currentIndex);
    dropdown.value = currentIndex;
    loadMedia(currentIndex);
  };

  showLoading(false);
  console.log('main() finalizado');
}

async function loadMedia(i) {
  console.log('loadMedia index=', i, mediaList[i]);
  showLoading(true);
  try {
    await currentModule.load(mediaList[i]);
    console.log('media carregada com sucesso');
  } catch (err) {
    console.error('erro ao carregar mídia:', err);
  }
  showLoading(false);
}

function showLoading(v) {
  loadingEl.style.display = v ? 'block' : 'none';
}
