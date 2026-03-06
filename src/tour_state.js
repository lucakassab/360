class TourState extends EventTarget {
  constructor() {
    super();

    this.state = {
      tourData: null,
      tourPath: "",
      currentSceneId: "",
      mode: "normal",
    };
  }

  getSnapshot() {
    return {
      ...this.state,
      currentScene: this.getCurrentScene(),
    };
  }

  getTourData() {
    return this.state.tourData;
  }

  getTourPath() {
    return this.state.tourPath;
  }

  getMode() {
    return this.state.mode;
  }

  getCurrentScene() {
    const tourData = this.state.tourData;
    if (!tourData || !Array.isArray(tourData.scenes)) {
      return null;
    }

    return (
      tourData.scenes.find((scene) => scene.id === this.state.currentSceneId) || null
    );
  }

  resolveScene(sceneId) {
    const tourData = this.state.tourData;

    if (!tourData || !Array.isArray(tourData.scenes)) {
      return null;
    }

    return tourData.scenes.find((scene) => scene.id === sceneId) || null;
  }

  resolveLinkedTour(targetTour) {
    const linkedTours = this.state.tourData?.linkedTours || [];
    return (
      linkedTours.find(
        (item) => item.id === targetTour || item.path === targetTour
      ) || null
    );
  }

  setMode(mode) {
    if (this.state.mode === mode) {
      return;
    }

    this.state.mode = mode;
    this.dispatchEvent(
      new CustomEvent("modechange", {
        detail: this.getSnapshot(),
      })
    );
  }

  setTour(tourData, tourPath) {
    this.state.tourData = tourData;
    this.state.tourPath = tourPath;
    this.state.currentSceneId = "";

    this.dispatchEvent(
      new CustomEvent("tourchange", {
        detail: this.getSnapshot(),
      })
    );
  }

  setCurrentScene(sceneId) {
    const scene = this.resolveScene(sceneId);

    if (!scene) {
      throw new Error(`Cena "${sceneId}" não existe no tour atual.`);
    }

    this.state.currentSceneId = sceneId;

    this.dispatchEvent(
      new CustomEvent("scenechange", {
        detail: {
          ...this.getSnapshot(),
          currentScene: scene,
        },
      })
    );
  }

  subscribe(eventName, handler) {
    this.addEventListener(eventName, handler);
    return () => this.removeEventListener(eventName, handler);
  }
}

export const tourState = new TourState();