// platforms/vr_inputs.js
// Captura inputs de controladores WebXR (Meta Quest) e dispara callbacksA/B sem interferir no loop de render

/**
 * Inicializa polling de botões A e B em WebXR sem substituir o animation loop do renderer.
 * @param {THREE.WebGLRenderer} renderer - renderer XR habilitado
 * @param {Function} onNext - callback para avançar mídia (botão A)
 * @param {Function} onPrev - callback para voltar mídia (botão B)
 */
export function setupVRInputs(renderer, onNext, onPrev) {
  function handleSession(session) {
    // limpa histórico ao trocar controladores
    session.addEventListener('inputsourceschange', () => {
      // nada a fazer, histórico fica no frame
    });

    session.requestReferenceSpace('local').then(refSpace => {
      function onXRFrame(time, frame) {
        // poll em cada frame
        for (const source of session.inputSources) {
          if (!source.gamepad) continue;
          const gp = source.gamepad;
          // gp.buttons[0] = A, gp.buttons[1] = B
          if (gp.buttons[0].pressed) onNext();
          if (gp.buttons[1].pressed) onPrev();
        }
        // agenda próxima
        session.requestAnimationFrame(onXRFrame);
      }
      session.requestAnimationFrame(onXRFrame);
    }).catch(err => console.error('VRInputs: falha ao obter referenceSpace', err));
  }

  // Se já em sessão, inicia polling
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // Ao iniciar sessão
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
