// platforms/vr_inputs.js
const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object} handlers
 *   @param {Function} handlers.onNext       — botão A
 *   @param {Function} handlers.onPrev       — botão B
 *   @param {Function} handlers.onToggleHUD  — stick-press (índice 3)
 *   @param {Function} handlers.onSnap       — snap-turn via thumbsticks
 *   @param {Function} handlers.onDebugLog   — log de qualquer botão/index
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

    // Reconecta/disconecta controllers ou mão
    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
      session.inputSources.forEach(src => {
        if (src.hand) {
          onDebugLog(src.handedness, 'hand-connected');
        } else if (src.targetRayMode === 'tracked-pointer') {
          onDebugLog(src.handedness, 'controller-connected');
        }
      });
    });

    // Loop de polling
    function poll() {
      for (const src of session.inputSources) {
        // — HAND-TRACKING (somente log de aparecimento) —
        if (src.hand && !src.gamepad) {
          const hid = `hand|${src.handedness}`;
          if (!prevStates.has(hid)) {
            onDebugLog(src.handedness, 'hand-detected');
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

        // — BOTÕES —
        const curr = gp.buttons.map(b => b.pressed);
        curr.forEach((pressed, idx) => {
          if (pressed && !prev.buttons[idx]) {
            // **log de debug de qualquer botão novo**
            onDebugLog(src.handedness, idx);

            // ações específicas
            if (idx === 4) {
              onNext && onNext();
            } else if (idx === 5) {
              onPrev && onPrev();
            } else if (idx === 3) {
              onToggleHUD && onToggleHUD();
            }
          }
        });

        // — SNAP TURN via eixo X do thumbstick —
        let x = 0;
        // stick esquerdo = axes[0], direito = axes[2] se existir
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
          onDebugLog(src.handedness, `snap ${dir>0?'▶':'◀'}`);
          prev._snapDone = true;
        }

        // salva estado para comparar no próximo frame
        prev.buttons = curr;
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local')
      .then(() => session.requestAnimationFrame(poll));
  }

  // se já estiver em VR
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // quando entrar em VR
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
