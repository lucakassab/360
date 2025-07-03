// platforms/vr_inputs.js

const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object|Function} handlersOrNext
 *    - Se for função: apenas onNext
 *    - Se for objeto: { onNext, onPrev, onToggleHUD, onSnap, onDebugLog }
 * @param {Function} [maybePrev]     onPrev, se handlersOrNext for função
 * @param {Function} [maybeDebugLog] onDebugLog, se handlersOrNext for função
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
      prevStates.clear();
      // log de novas fontes
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
        // --- hand-tracking detectado ---
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
          prev = { buttons: Array(gp.buttons.length).fill(false), _snapDone: false };
        }

        // --- botões (log + ações) ---
        const curr = gp.buttons.map(b => b.pressed);
        curr.forEach((pressed, idx) => {
          if (pressed && !prev.buttons[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);

            if (idx === 4) onNext      && onNext();       // A
            else if (idx === 5) onPrev && onPrev();       // B
            else if (idx === 3) onToggleHUD && onToggleHUD(); // stick-press
          }
        });

        // --- snap turn nos dois sticks ---
        let x;
        if (src.handedness === 'right' && gp.axes.length >= 4) {
          x = gp.axes[2];       // eixo X do stick direito
        } else {
          x = gp.axes[0] ?? 0;  // eixo X do stick esquerdo (ou fallback)
        }
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        prev.buttons = curr;
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local')
      .then(() => session.requestAnimationFrame(poll));
  }

  // se já estiver entrando em VR
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
