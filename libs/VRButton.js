class VRButton {
  static createButton(renderer, options = {}) {
    const {
      referenceSpaceType = 'local-floor',
      optionalFeatures = [],
      requiredFeatures = []
    } = options;

    const button = document.createElement('button');
    stylizeElement(button);
    button.disabled = true;
    button.textContent = 'CHECANDO VR...';

    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr')
        .then((supported) => {
          if (supported) {
            button.disabled = false;
            button.textContent = 'ENTER VR';
            let session = null;
            button.onclick = async () => {
              if (!session) {
                try {
                  session = await navigator.xr.requestSession('immersive-vr', {
                    optionalFeatures: [...optionalFeatures],
                    requiredFeatures: [...requiredFeatures, referenceSpaceType]
                  });
                  await renderer.xr.setSession(session);
                  button.textContent = 'EXIT VR';
                  session.addEventListener('end', () => {
                    session = null;
                    button.textContent = 'ENTER VR';
                  });
                } catch (err) {
                  console.error('Falha ao iniciar sessão VR:', err);
                }
              } else {
                await session.end();
              }
            };
          } else {
            button.disabled = true;
            button.textContent = 'VR NOT SUPPORTED';
          }
        })
        .catch((err) => {
          button.disabled = true;
          button.textContent = 'VR NOT ALLOWED';
          console.warn('Erro ao verificar suporte XR:', err);
        });
    } else {
      button.disabled = true;
      if (!window.isSecureContext) {
        button.textContent = 'WEBXR NEEDS HTTPS';
      } else {
        button.textContent = 'WEBXR NOT AVAILABLE';
      }
    }

    return button;

    function stylizeElement(el) {
      Object.assign(el.style, {
        position: 'absolute',
        bottom: '20px',
        padding: '12px 6px',
        border: '1px solid #fff',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.1)',
        color: '#fff',
        font: 'normal 13px sans-serif',
        textAlign: 'center',
        opacity: '0.8',
        cursor: 'pointer',
        zIndex: '999'
      });
      el.onmouseenter = () => el.style.opacity = '1.0';
      el.onmouseleave = () => el.style.opacity = '0.8';
    }
  }
}

export { VRButton };