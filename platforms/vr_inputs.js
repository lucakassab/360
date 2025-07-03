// platforms/vr_inputs.js

// Separa toda a lógica de input VR: polling, snap turn, HUD toggle e debug logs.
const prevStates = new Map();

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object} handlers
 * @param {Function} handlers.onNext       Chama ao pressionar A
 * @param {Function} handlers.onPrev       Chama ao pressionar B
 * @param {Function} handlers.onToggleHUD  Chama ao pressionar stick click
 * @param {Function} handlers.onSnap       Chama ao ultrapassar deadzone do stick
 * @param {Function} handlers.onDebugLog   Chama em qualquer botão novo, (handedness, index)
 */
export function setupVRInputs(renderer, {
  onNext,
  onPrev,
  onToggleHUD,
  onSnap,
  onDebugLog
}) {
  function handleSession(session) {
    prevStates.clear();
    session.addEventListener('inputsourceschange', () => prevStates.clear());

    function poll(time, frame) {
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        const id = `${src.handedness}|${gp.id}`;
        const prev = prevStates.get(id) || [];

                // Botões (A=4, B=5)
        src.gamepad.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);
            if (idx === 4) onNext && onNext(); // A
            if (idx === 5) onPrev && onPrev(); // B
            if (idx === 3) onToggleHUD && onToggleHUD(); // stick click
          }
        });

        // Snap turn via thumbstick esquerdo ou direito
        const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        const was = prev._snapDone;
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!was) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // Atualiza estado (inclui flag snap)
        const state = gp.buttons.map(b => b.pressed);
        state._snapDone = prev._snapDone;
        prevStates.set(id, state);
      }
      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local').then(() => session.requestAnimationFrame(poll));
  }

  // in case já está apresentando
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
