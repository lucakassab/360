// js/main.js

(() => {
  const SCENE = document.querySelector('#scene');
  const mediaNameEl = document.querySelector('#mediaName');
  const prevBtn = document.querySelector('#prevBtn');
  const nextBtn = document.querySelector('#nextBtn');

  let mediaList = [];
  let currentIndex = 0;
  let currentEntity = null; // referência ao <a-entity> ou <a-sky> que exibimos

  // 1) Carrega o JSON com fetch():
  fetch('./load_media_list.json')
    .then(res => {
      if (!res.ok) throw new Error('Não consegui carregar o JSON das mídias');
      return res.json();
    })
    .then(json => {
      mediaList = json;
      if (!mediaList.length) {
        mediaNameEl.textContent = 'JSON vazio. Sem mídia pra exibir.';
        return;
      }
      // Exibe a primeira mídia
      loadMedia(0);
    })
    .catch(err => {
      console.error('[main.js] Erro ao buscar JSON:', err);
      mediaNameEl.textContent = 'Erro ao carregar mídias';
    });

  // 2) Função para carregar mídia por índice
  function loadMedia(idx) {
    // Remover entidade anterior (se existir)
    if (currentEntity) {
      SCENE.removeChild(currentEntity);
      currentEntity = null;
    }

    currentIndex = idx;
    const item = mediaList[currentIndex];
    mediaNameEl.textContent = item.name;

    const url = item.url;
    const lower = url.toLowerCase();

    // Detecta se é vídeo: mp4, webm, etc.
    const isVideo = lower.match(/\.(mp4|webm|ogg)$/);
    // Detecta imagem estéreo 360: pode usar nome do arquivo (contain "stereo") ou ter montagem lado a lado
    const isStereoImage = !isVideo && (lower.includes('stereo') || item.name.toLowerCase().includes('stereo'));
    // Caso contrário, assume imagem mono (jpg, png)
    const isMonoImage = !isVideo && !isStereoImage && lower.match(/\.(jpg|jpeg|png)$/);

    if (isVideo) {
      loadVideoSphere(url);
    } else if (isStereoImage) {
      loadStereoImage(url);
    } else if (isMonoImage) {
      loadMonoImage(url);
    } else {
      console.warn('[main.js] Formato da mídia não reconhecido:', url);
      mediaNameEl.textContent = 'Formato não suportado';
    }
  }

  // 2.1) Carrega imagem mono 360°:
  function loadMonoImage(src) {
    // Cria <a-sky> com a imagem como texturão
    const sky = document.createElement('a-sky');
    sky.setAttribute('src', src);
    sky.setAttribute('rotation', '0 -130 0');
    currentEntity = sky;
    SCENE.appendChild(sky);
  }

  // 2.2) Carrega imagem estéreo 360°:
  function loadStereoImage(src) {
    // Usa <a-entity> com geometria esfera e o stereo-component
    // Assume que a imagem é side-by-side (metade esquerda = olho esquerdo, metade direita = olho direito)
    const sphere = document.createElement('a-entity');
    sphere.setAttribute('geometry', 'primitive: sphere; radius: 5000;');
    // Mostrar o interior da esfera
    sphere.setAttribute('material', 'shader: flat; side: back; src: ' + src);
    // Configura o stereo-component
    sphere.setAttribute('stereo', 'eye: left;'); // a lógica do stereo-component lê imagem inteira e divide
    // Precisamos colocar outra entidade idêntica para o olho direito:
    const sphereRight = document.createElement('a-entity');
    sphereRight.setAttribute('geometry', 'primitive: sphere; radius: 5000;');
    sphereRight.setAttribute('material', 'shader: flat; side: back; src: ' + src);
    sphereRight.setAttribute('stereo', 'eye: right;');

    // Criamos um container vazio
    const container = document.createElement('a-entity');
    container.appendChild(sphere);
    container.appendChild(sphereRight);
    currentEntity = container;
    SCENE.appendChild(container);
  }

  // 2.3) Carrega vídeo 360° mono (se quiser stereo em vídeo seria outra treta)
  function loadVideoSphere(src) {
    // Cria <a-assets> e <video> dinamicamente pra cada URL
    const assets = document.querySelector('a-assets') || document.createElement('a-assets');
    if (!assets.parentNode) SCENE.appendChild(assets);

    // Remove video anterior se existir
    const oldVideo = assets.querySelector('video[id="dynVideo"]');
    if (oldVideo) assets.removeChild(oldVideo);

    const video = document.createElement('video');
    video.setAttribute('id', 'dynVideo');
    video.setAttribute('src', src);
    video.setAttribute('crossorigin', 'anonymous');
    video.setAttribute('loop', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    assets.appendChild(video);

    // Cria a esfera que exibe o vídeo
    const sphere = document.createElement('a-videosphere');
    sphere.setAttribute('src', '#dynVideo');
    sphere.setAttribute('rotation', '0 -130 0');
    currentEntity = sphere;
    SCENE.appendChild(sphere);

    // Garante que o vídeo comece a rodar
    video.play().catch(e => {
      console.warn('[main.js] Erro ao dar play no vídeo:', e);
    });
  }

  // 3) Navegação anterior/próxima
  prevBtn.addEventListener('click', () => {
    const prev = (currentIndex - 1 + mediaList.length) % mediaList.length;
    loadMedia(prev);
  });
  nextBtn.addEventListener('click', () => {
    const next = (currentIndex + 1) % mediaList.length;
    loadMedia(next);
  });
})();
