// platforms/vr/generic_vr.js
import * as THREE from '../../libs/three.module.js';

export function initControllers({ renderer, scene, referenceSpace }) {
  const session = renderer.xr.getSession();
  session.inputSources.forEach((source, i) => {
    // só trata se vier gamepad (controle conectado)
    if (!source.gamepad) return;
    const controller = renderer.xr.getController(i);

    // select → next
    controller.addEventListener('select', () => {
      if (window.onNext) window.onNext();
    });

    // squeeze → prev
    controller.addEventListener('squeeze', () => {
      if (window.onPrev) window.onPrev();
    });

    scene.add(controller);
  });
}
  