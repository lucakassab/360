// platforms/vr_inputs.js
const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object|Function} handlersOrNext
 *    - Se for função: apenas onNext (avançar mídia)
 *    - Se for objeto: { onNext, onPrev, onToggleHUD, onSnap, onDebugLog }
 * @param {Function} [maybePrev]       onPrev, se handlersOrNext for função
 * @param {Function} [maybeDebugLog]   onDebugLog, se handlersOrNext for função
 */
export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;

  if (typeof handlersOrNext === 'function') {
    // LEGACY: (renderer, onNext, onPrev, onDebugLog)
    onNext      = handlersOrNext;
    onPrev      = maybePrev;
    onToggleHUD = () => {};
    onSnap      = () => {};
    onDebugLog  = maybeDebugLog;
  } else {
    // MODERNO: (renderer, { onNext, onPrev, onToggleHUD, onSnap, onDebugLog })
    ({ onNext, onPrev, onToggleHUD, onSnap, onDebugLog } = handlersOrNext);
  }

  function handleSession(session) {
    prevStates.clear();

    // Reconecta / desconecta fontes (controller ↔ handtracking)
    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
      session.inputSources.forEach(src => {
        if (src.hand) {
          onDebugLog && onDebugLog(src.handedness, 'hand-connected');
        } else if (src.targetRayMode === 'tracked-pointer') {
          onDebugLog && onDebugLog(src.handedness, 'controller-connected');
        }
      });
    });

    function poll() {
      for (const src of session.inputSources) {
        // === HAND-TRACKING ===
        if (src.hand && !src.gamepad) {
          const hid = `hand|${src.handedness}`;
          if (!prevStates.has(hid)) {
            onDebugLog && onDebugLog(src.handedness, 'hand-detected');
            prevStates.set(hid, { seen: true });
          }
          continue;
        }

        const gp = src.gamepad;
        if (!gp) continue;

        const id = `${src.handedness}|${gp.id}`;
        let prev = prevStates.get(id);
        if (!prev) {
          prev = {
            buttons: Array(gp.buttons.length).fill(false),
            _snapDone: false
          };
        }

        // === BOTÕES ===
        const curr = gp.buttons.map(b => b.pressed);
        curr.forEach((pressed, idx) => {
          if (pressed && !prev.buttons[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);

            // A (4) e B (5)
            if (idx === 4) onNext && onNext();
            else if (idx === 5) onPrev && onPrev();
            // Toggle HUD = thumbstick-press (índice 3)
            else if (idx === 3) onToggleHUD && onToggleHUD();
          }
        });

        // === SNAP TURN ===
        // stick esquerdo: axes[0], direito: axes[2] (se existirem)
        let x = 0;
        if (src.handedness === 'left') {
          x = gp.axes[0] || 0;
        } else {
          x = gp.axes.length >= 4 ? gp.axes[2] : 0;
        }

        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // Atualiza estado
        prev.buttons = curr;
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local')
      .then(() => session.requestAnimationFrame(poll));
  }

  // Se já estivermos em VR
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // Ao começar sessão VR
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
