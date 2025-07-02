// platforms/vr_inputs.js
// Captura inputs de controladores WebXR (Meta Quest) e dispara callbacks

// Map para armazenar estados anteriores dos botões
let _prevButtonStates = new Map();

/**
 * Inicia o polling dos gamepad input sources do WebXR e dispara onNext/onPrev
 * @param {THREE.WebGLRenderer} renderer – o renderer XR já inicializado
 * @param {Function} onNext – chamado quando o usuário aperta “A”
 * @param {Function} onPrev – chamado quando o usuário aperta “B”
 */
export function setupVRInputs(renderer, onNext, onPrev) {
  function handleSession(session) {
    // limpa estado se trocar de controlador
    session.addEventListener('inputsourceschange', () => {
      _prevButtonStates.clear();
    });

    // Polling nos botões usando o animation loop do renderer
    function poll(time, frame) {
      const sources = session.inputSources;
      for (const source of sources) {
        if (!source.gamepad) continue;
        const gp = source.gamepad;
        const id = source.handedness + '|' + gp.id;
        const prev = _prevButtonStates.get(id) || [];

        gp.buttons.forEach((btn, idx) => {
          // idx 0 = botão A, idx 1 = botão B
          if (btn.pressed && !prev[idx]) {
            if (idx === 0) onNext();
            if (idx === 1) onPrev();
          }
        });

        // armazena estado atual
        _prevButtonStates.set(id, gp.buttons.map(b => b.pressed));
      }
      // continua o loop
      renderer.setAnimationLoop(poll);
    }

    // começa o polling
    renderer.setAnimationLoop(poll);
  }

  // Se já estiver apresentando, inicia de imediato
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }

  // Quando iniciar sessão, conecta handler
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
