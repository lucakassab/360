// js/main.js
const MEDIA = [ /* igual antes */ ];
const select = document.getElementById('sceneSelect');
const spinner = document.getElementById('spinner');

function isMono(url) { return /_Mono(\.[a-z0-9]+)$/i.test(url); }
function showSpinner() { spinner.style.display = 'block'; }
function hideSpinner() { spinner.style.display = 'none'; }

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  const scene = document.querySelector('a-scene');
  const assets = document.querySelector('a-assets');
  scene.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (item.url.endsWith('.mp4')) {
    const video = document.createElement('video');
    video.id = 'vid';
    video.src = item.url;
    /* resto igual */
  } else {
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('src', item.url);
    if (!mono) sky.setAttribute('stereo-top-bottom', '');
    sky.setAttribute('look-controls', 'touchEnabled: true; mouseEnabled: true; gyroscopeEnabled: false');
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }
}

select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  if (!isMono(item.url)) await import('../libs/aframe-stereo-component.js');
});
loadMedia(MEDIA[0]);