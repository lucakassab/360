// platforms/vr_inputs.js
// Separa toda a lógica de input VR: polling, snap turn, HUD toggle e debug logs.
const prevStates = new Map();

/**
 * Configura polling de inputs VR.
 * Pode receber <renderer, onNext, onPrev, onDebugLog> ou <renderer, handlersObject>.
 * @param {THREE.WebGLRenderer} renderer
 * @param {Function|Object} handlersOrNext - função onNext ou objeto de handlers
 * @param {Function} [maybePrev]     - onPrev callback se usar posicional
 * @param {Function} [maybeDebugLog] - onDebugLog callback se usar posicional
 */
export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;
  if (typeof handlersOrNext === 'function') {
    onNext       = handlersOrNext;
    onPrev       = maybePrev;
    onToggleHUD  = () => {};
    onSnap       = () => {};
    onDebugLog   = maybeDebugLog;
  } else {
    ({ onNext, onPrev, onToggleHUD, onSnap, onDebugLog } = handlersOrNext);
  }

  function handleSession(session) {
    prevStates.clear();
    session.addEventListener('inputsourceschange', () => prevStates.clear());

    function poll() {
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        const id   = `${src.handedness}|${gp.id}`;
        const prev = prevStates.get(id) || [];

        // Botões: A=4, B=5, stick click=3
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);
            if (idx === 4) onNext  && onNext();      // A
            if (idx === 5) onPrev  && onPrev();      // B
            if (idx === 3) onToggleHUD && onToggleHUD(); // stick click
          }
        });

        // Snap turn via thumbstick (ambos controles)
        const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        const done = prev._snapDone;
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!done) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // Atualiza estado e flag de snap
        const state = gp.buttons.map(b => b.pressed);
        state._snapDone = prev._snapDone;
        prevStates.set(id, state);
      }
      session.requestAnimationFrame(poll);
    }
    session.requestReferenceSpace('local').then(() => session.requestAnimationFrame(poll));
  }

  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
