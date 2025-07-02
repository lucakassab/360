// platforms/vr_inputs.js
// Captura inputs de controladores WebXR (Meta Quest) e dispara callbacks para debug e A/B

// Armazena estado anterior dos botões para detectar transições
const previousStates = new Map();

/**
 * Inicializa polling de gamepad inputs no WebXR sem interferir no loop de render.
 * @param {THREE.WebGLRenderer} renderer - o renderer XR habilitado
 * @param {Function} onNext - callback quando se detecta botão "A"
 * @param {Function} onPrev - callback quando se detecta botão "B"
 * @param {Function} onDebug - callback para qualquer botão detectado, recebe string crua do input
 */
export function setupVRInputs(renderer, onNext, onPrev, onDebug) {
  function handleSession(session) {
    session.addEventListener('inputsourceschange', () => {
      previousStates.clear();
    });

    session.requestReferenceSpace('local').then(refSpace => {
      function poll(time, frame) {
        for (const source of session.inputSources) {
          if (!source.gamepad) continue;
          const gp = source.gamepad;
          const id = ${source.handedness}|${gp.id};
          const prev = previousStates.get(id) || [];

          gp.buttons.forEach((btn, idx) => {
            if (btn.pressed && !prev[idx]) {
              const raw = ${id} button[${idx}];
              onDebug(raw);
              if (idx === 0) onNext();
              if (idx === 1) onPrev();
            }
          });

          previousStates.set(id, gp.buttons.map(b => b.pressed));
        }
        session.requestAnimationFrame(poll);
      }
      session.requestAnimationFrame(poll);
    });
  }

  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
