import { resolveAssetPath } from "./tour_loader.js";

const preloadPromiseCache = new Map();

function uniquePush(set, value) {
  if (!value) return;
  set.add(value);
}

function preloadImage(url) {
  if (!url) {
    return Promise.resolve({
      url,
      ok: false,
      skipped: true,
    });
  }

  if (preloadPromiseCache.has(url)) {
    return preloadPromiseCache.get(url);
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";

    const finishSuccess = async () => {
      try {
        if (typeof img.decode === "function") {
          await img.decode().catch(() => {});
        }
      } catch {
        // ignora
      }

      resolve({
        url,
        ok: true,
        skipped: false,
      });
    };

    const finishError = () => {
      resolve({
        url,
        ok: false,
        skipped: false,
      });
    };

    img.onload = finishSuccess;
    img.onerror = finishError;

    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      finishSuccess();
    }
  });

  preloadPromiseCache.set(url, promise);
  return promise;
}

function collectTourAssetUrls(tourData, tourPath) {
  const urls = new Set();

  if (!tourData || !Array.isArray(tourData.scenes)) {
    return [];
  }

  for (const scene of tourData.scenes) {
    uniquePush(
      urls,
      resolveAssetPath(tourData, tourPath, scene?.image360 || "")
    );

    uniquePush(
      urls,
      resolveAssetPath(tourData, tourPath, scene?.imageMap || "")
    );

    const hotspots = Array.isArray(scene?.hotspots) ? scene.hotspots : [];

    for (const hotspot of hotspots) {
      uniquePush(
        urls,
        resolveAssetPath(tourData, tourPath, hotspot?.imageHotspot || "")
      );
    }
  }

  return Array.from(urls);
}

export async function preloadTourAssets({
  tourData,
  tourPath,
  onProgress = null,
  debug = false,
} = {}) {
  const urls = collectTourAssetUrls(tourData, tourPath);
  const total = urls.length;

  if (debug) {
    console.log("[preload] iniciando pré-carga do tour", {
      tourName: tourData?.tourName || "",
      totalAssets: total,
      tourPath,
    });
  }

  let loaded = 0;
  let failed = 0;

  const results = await Promise.all(
    urls.map(async (url) => {
      const result = await preloadImage(url);

      if (result.ok) {
        loaded += 1;
      } else if (!result.skipped) {
        failed += 1;
      }

      if (typeof onProgress === "function") {
        onProgress({
          url,
          total,
          loaded,
          failed,
        });
      }

      return result;
    })
  );

  const summary = {
    total,
    loaded,
    failed,
    results,
  };

  if (debug) {
    console.log("[preload] pré-carga finalizada", summary);
  }

  return summary;
}