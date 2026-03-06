export async function detectPlatform() {
  const userAgent = (navigator.userAgent || "").toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isQuest = /oculusbrowser|quest|meta quest/.test(userAgent);

  const hasTouch = navigator.maxTouchPoints > 0;
  const isTablet =
    /ipad|tablet/.test(userAgent) || (isAndroid && !/mobile/.test(userAgent));
  const isMobile = (isIOS || isAndroid || hasTouch) && !isTablet;

  let supportsImmersiveVr = false;

  if (navigator.xr?.isSessionSupported) {
    try {
      supportsImmersiveVr = await navigator.xr.isSessionSupported("immersive-vr");
    } catch {
      supportsImmersiveVr = false;
    }
  }

  let label = "Desktop";

  if (isQuest) {
    label = "Quest Browser";
  } else if (isTablet) {
    label = "Tablet";
  } else if (isMobile) {
    label = "Celular";
  }

  return {
    userAgent,
    isIOS,
    isAndroid,
    isQuest,
    isTablet,
    isMobile,
    hasTouch,
    supportsImmersiveVr,
    label,
    initialMode: "normal",
  };
}