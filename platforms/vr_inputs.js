// platforms/vr_inputs.js

const prevStates = new Map();

export function setupVRInputs(renderer, {
  onNext,
  onPrev,
  onToggleHUD,
  onSnap,
  onDebugLog
}) {
  function handleSession(session) {
    prevStates.clear();

    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
    });

    function poll(time, frame) {
      session.inputSources.forEach(src => {
        if (!src.gamepad) return;
        const id = `${src.handedness}|${src.gamepad.id}`;
        const prev = prevStates.get(id) || [];

        // Botões
        src.gamepad.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);
            if (idx === 4) onNext && onNext();
            if (idx === 5) onPrev && onPrev();
            if (idx === 3) onToggleHUD && onToggleHUD();
          }
        });

        // Snap turn via thumbstick esquerdo ou direito
        const x = src.gamepad.axes.length >= 4 ? src.gamepad.axes[2] : src.gamepad.axes[0];
        const was = prev._snapDone;
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!was) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // Atualiza estado
        prevStates.set(id, Object.assign(gpToBools(src.gamepad), { _snapDone: prev._snapDone }));
      });

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local').then(() => {
      session.requestAnimationFrame(poll);
    });
  }

  if (renderer.xr.isPresenting) handleSession(renderer.xr.getSession());

  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}

function gpToBools(gp) {
  return gp.buttons.map(b => b.pressed);
}
