// platforms/vr_inputs.js
// Captura inputs de controladores WebXR (Meta Quest) e dispara callbacks

let _prevButtonStates = new Map();

/**
 * Inicializa a captura de inputs VR.
 * @param {THREE.WebGLRenderer} renderer - O renderer XR já inicializado.
 * @param {Function} onNext - Callback para avançar mídia (botão A).
 * @param {Function} onPrev - Callback para voltar mídia (botão B).
 */
export function setupVRInputs(renderer, onNext, onPrev) {
  function handleSession(session) {
    session.addEventListener('inputsourceschange', () => {
      // zera estados quando mudar controlador
      _prevButtonStates.clear();
    });

    const refSpacePromise = session.requestReferenceSpace('local');
    refSpacePromise.then((refSpace) => {
      function poll(time, frame) {
        const inputSources = session.inputSources;
        inputSources.forEach(source => {
          if (!source.gamepad) return;
          const gp = source.gamepad;
          const id = source.handedness + '|' + gp.id;

          const prev = _prevButtonStates.get(id) || [];
          gp.buttons.forEach((btn, idx) => {
            if (btn.pressed && !prev[idx]) {
              // botão acabou de ser pressionado
              if (idx === 0) onNext(); // botão A
              if (idx === 1) onPrev(); // botão B
            }
          });
          // atualiza histórico
          _prevButtonStates.set(id, gp.buttons.map(b => b.pressed));
        });
        renderer.setAnimationLoop(poll);
      }
      // começa polling
      renderer.setAnimationLoop(poll);
    });
  }

  // se já estiver em sessão
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // ao iniciar sessão, anexa
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
