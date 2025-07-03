// platforms/vr_inputs.js

const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e mãos).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object|Function} handlersOrNext
 *    Se for função: onNext
 *    Se for objeto: { onNext, onPrev, onToggleHUD, onSnap, onDebugLog }
 * @param {Function} [maybePrev]
 * @param {Function} [maybeDebugLog]
 */
export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;
  if (typeof handlersOrNext === 'function') {
    onNext      = handlersOrNext;
    onPrev      = maybePrev;
    onToggleHUD = () => {};
    onSnap      = () => {};
    onDebugLog  = maybeDebugLog;
  } else {
    ({ onNext, onPrev, onToggleHUD, onSnap, onDebugLog } = handlersOrNext);
  }

  function handleSession(session) {
    prevStates.clear();

    session.addEventListener('inputsourceschange', () => {
      // toda vez que mudar fontes de entrada (controller ↔ handtracking)
      prevStates.clear();
      // log de handtracking connect/disconnect
      session.inputSources.forEach(src => {
        if (src.hand) {
          onDebugLog && onDebugLog('hand', 'connected');
        } else if (src.targetRayMode === 'tracked-pointer') {
          onDebugLog && onDebugLog(src.handedness, 'controller-connected');
        }
      });
    });

    function poll() {
      for (const src of session.inputSources) {
        const gp = src.gamepad;

        // hand-tracking não tem gp, mas queremos logar quando aparece/desaparece
        if (!gp && src.hand) {
          // a cada frame, se ainda não marcado nos prevStates, loga
          const id = `hand|${src.handedness}`;
          if (!prevStates.has(id)) {
            onDebugLog && onDebugLog(src.handedness, 'hand-detected');
            prevStates.set(id, { hand: true });
          }
          continue;
        }

        if (!gp) continue;

        const id   = `${src.handedness}|${gp.id}`;
        const prev = prevStates.get(id) || { buttons: [], _snapDone: false };

        // 1) Botões (A=4, B=5, stick click=3, qualquer outro para debug)
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev.buttons[idx]) {
            // log genérico
            onDebugLog && onDebugLog(src.handedness, idx);
            // avanços / retornos
            if (idx === 4) onNext      && onNext();
            if (idx === 5) onPrev      && onPrev();
            // toggle HUD
            if (idx === 3) onToggleHUD && onToggleHUD();
          }
        });

        // 2) Snap turn via eixo X do thumbstick (para ambos controles)
        const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // atualiza estado
        prev.buttons = gp.buttons.map(b => b.pressed);
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local').then(() => {
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
