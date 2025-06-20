

function isMono(url) { return /_Mono(\.[a-z0-9]+)$/i.test(url); }
function showSpinner(){ spinner.style.display = 'block'; }
function hideSpinner(){ spinner.style.display = 'none'; }

// Busca lista de arquivos do GitHubsync function fetchMediaList() {
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  return json.filter(f => f.type === 'file')
             .map(f => ({ name: f.name, url: `media/${f.name}` }));
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (item.url.match(/\.(mp4|webm)$/i)) {
    // Vídeo
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline', '');
    await vid.play(); assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src', '#vid');
    vs.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      vs.setAttribute('material', 'shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    }
    scene.appendChild(vs);
    hideSpinner();

  } else {
    // Imagem
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (mono) {
      sky.setAttribute('src', item.url);
    } else {
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }
}

function enableDragOrbit() {
  // Quando a cena carrega, pega a camera e adiciona drag
  scene.addEventListener('loaded', () => {
    // camera entity com component camera
    const camEl = scene.querySelector('[camera]');
    cameraObj = camEl.object3D;
    let isDown = false, lastX = 0, lastY = 0;
    let yaw = 0, pitch = 0;
    const canvas = scene.canvas;
    const sensitivity = 0.005;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { isDown = true; lastX = e.clientX; lastY = e.clientY; });
    canvas.addEventListener('pointerup', () => { isDown = false; });
    canvas.addEventListener('pointerleave', () => { isDown = false; });

    canvas.addEventListener('pointermove', e => {
      if (!isDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      yaw   -= dx * sensitivity;
      pitch -= dy * sensitivity;
      // limita pitch para não virar de cabeça pra baixo
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      // aplica rotação sem roll (rotações em Z sempre zero)
      cameraObj.rotation.set(pitch, yaw, 0);
      lastX = e.clientX;
      lastY = e.clientY;
    });
  });
}

async function init() {
  const MEDIA = await fetchMediaList();
  // popula dropdown
  MEDIA.forEach((m, i) => {
    const opt = document.createElement('option'); opt.value = i; opt.text = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);

  // entra no VR? importa plugin estéreo e aplica
  window.addEventListener('enter-vr', async () => {
    const item = MEDIA[select.value];
    if (!isMono(item.url)) {
      await import('../libs/aframe-stereo-component.js');
      const ent = document.querySelector('.dyn-media');
      ent.removeAttribute('material');
      ent.setAttribute('stereo-top-bottom', '');
    }
  });

  enableDragOrbit();
}

init();