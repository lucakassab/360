// platforms/vr_inputs.js
// Poll VR controller inputs each XR frame using session.requestAnimationFrame,
// without touching renderer.setAnimationLoop.

const previousStates = new Map();

/**
 * Initialize polling of gamepad inputs in WebXR.
 * @param {THREE.WebGLRenderer} renderer - XR-enabled renderer
 * @param {Function} onNext - callback for button A (index 4)
 * @param {Function} onPrev - callback for button B (index 5)
 * @param {Function} onDebug - callback for any button pressed, receives raw input string
 */
export function setupVRInputs(renderer, onNext, onPrev, onDebug) {
  function handleSession(session) {
    previousStates.clear();
    session.addEventListener('inputsourceschange', () => {
      previousStates.clear();
    });

    function poll(time, frame) {
      for (const source of session.inputSources) {
        if (!source.gamepad) continue;
        const gp = source.gamepad;
        const id = `${source.handedness}|${gp.id}`;
        const prev = previousStates.get(id) || [];

        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev[idx]) {
            const raw = `${id} button[${idx}]`;
            onDebug && onDebug(raw);
            if (idx === 4) onNext();
            if (idx === 5) onPrev();
          }
        });

        previousStates.set(id, gp.buttons.map(b => b.pressed));
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
