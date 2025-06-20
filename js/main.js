// js/main.js
const MEDIA = [
  { name: "Sala", url: "media/sala.jpg" },
  { name: "Cena Mono", url: "media/praia_Mono.jpg" },
  { name: "Vídeo Estéreo", url: "media/video360.mp4" },
  // adiciona mais objetos aqui
];

const select = document.getElementById('sceneSelect');
const spinner = document.getElementById('spinner');

function isMono(url) {
  return /_Mono(\.[a-z0-9]+)$/i.test(url);
}

function showSpinner() {
  spinner.style.display = 'block';
}

function hideSpinner() {
  spinner.style.display = 'none';
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  const scene = document.querySelector('a-scene');
  // remove mídia antiga
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (item.url.endsWith('.mp4')) {
    // vídeo
    const video = document.createElement('video');
    video.src = item.url;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.setAttribute('playsinline', '');
    await new Promise(res => video.addEventListener('loadedmetadata', res));
    await video.play();
    const entity = document.createElement('a-videosphere');
    entity.setAttribute('src', `#vid`);
    entity.setAttribute('class', 'dyn-media');
    entity.setAttribute('stereo-top-bottom', mono ? '' : '');
    entity.setAttribute('look-controls', 'touchEnabled: true; mouseEnabled: true; gyroscopeEnabled: false');
    const assets = document.querySelector('a-assets') || (() => {
      const a = document.createElement('a-assets'); document.querySelector('a-scene').appendChild(a); return a;
    })();
    video.id = 'vid';
    assets.appendChild(video);
    scene.appendChild(entity);
  } else {
    // imagem
    const imgUrl = item.url;
    const entity = document.createElement('a-sky');
    entity.setAttribute('src', imgUrl);
    entity.setAttribute('class', 'dyn-media');
    if (!mono) {
      entity.setAttribute('stereo-top-bottom', '');
    }
    entity.setAttribute('look-controls', 'touchEnabled: true; mouseEnabled: true; gyroscopeEnabled: false');
    scene.appendChild(entity);
    // espera carregamento
    entity.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }

  // importar plugin estéreo só se for estéreo e VR for ativado
  select.disabled = false;
}

// popula dropdown
MEDIA.forEach((m, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.text = m.name;
  select.appendChild(opt);
});

select.addEventListener('change', () => loadMedia(MEDIA[select.value]));

// intercepta botão VR
window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  if (!isMono(item.url)) {
    await import('../libs/aframe-stereo-component.js');
  }
});

// inicia com primeira mídia
loadMedia(MEDIA[0]);