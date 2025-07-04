// platforms/vr_inputs.js
const prevStates = new Map();
const lastLog = {};

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object} handlers
 *   @param onNext()       — botão A
 *   @param onPrev()       — botão B
 *   @param onToggleHUD()  — stick-press (índice 2 ou 3)
 *   @param onSnap(hand,dir) — snap-turn
 *   @param onDebugLog(hand,idxOrMsg) — log genérico
 */
export function setupVRInputs(renderer, {
  onNext, onPrev, onToggleHUD, onSnap, onDebugLog
}) {
  function deviceLabel(src) {
    // Retorna "left-controller", "right-hand", etc.
    if (src.hand) return ${src.handedness}-hand;
    if (src.targetRayMode === 'tracked-pointer') return ${src.handedness}-controller;
    return src.handedness || 'unknown';
  }

  function handleSession(session) {
    prevStates.clear();

    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
      session.inputSources.forEach(src => {
        onDebugLog(deviceLabel(src), 'connected');
      });
    });

    function poll() {
      const now = performance.now();
      for (const src of session.inputSources) {
        // — HAND-TRACKING —
        if (src.hand && !src.gamepad) {
          const hid = hand|${src.handedness};
          if (!prevStates.has(hid)) {
            onDebugLog(deviceLabel(src), 'hand-detected');
            prevStates.set(hid, { seen: true });
          }
          continue;
        }

        const gp = src.gamepad;
        if (!gp) continue;

        const id = ${src.handedness}|${gp.id};
        let prev = prevStates.get(id)
                || { buttons: Array(gp.buttons.length).fill(false), _snapDone: false };

        const curr = gp.buttons.map(b=>b.pressed);

        // — botões —
        curr.forEach((pressed, idx) => {
          const logKey = ${deviceLabel(src)}:button${idx};
          if (pressed && !prev.buttons[idx]) {
            if (!lastLog[logKey] || (now - lastLog[logKey]) > 100) {
              onDebugLog(deviceLabel(src), button${idx});
              lastLog[logKey] = now;
            }
            if (idx===4) onNext?.();
            else if (idx===5) onPrev?.();
            else if (idx===2||idx===3) onToggleHUD?.();
          }
        });

        // — snap turn (X do thumbstick) —
        const x = gp.axes[2] ?? gp.axes[0] ?? 0;
        const snapKey = ${deviceLabel(src)}:snap;
        if (Math.abs(x)<0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          if (!lastLog[snapKey] || (now - lastLog[snapKey]) > 100) {
            const dir = x>0?1:-1;
            onSnap?.(src.handedness, dir);
            onDebugLog(deviceLabel(src), snap ${dir>0?'▶':'◀'});
            lastLog[snapKey] = now;
          }
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

  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}