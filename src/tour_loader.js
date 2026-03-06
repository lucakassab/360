function splitPathSuffix(input) {
  const match = String(input ?? "").match(/^([^?#]*)([?#].*)?$/);
  return {
    pathPart: match?.[1] ?? "",
    suffix: match?.[2] ?? "",
  };
}

export function normalizePath(input = "") {
  if (!input) {
    return "";
  }

  if (/^(data:|blob:|https?:\/\/|file:\/\/)/i.test(input)) {
    return input;
  }

  const { pathPart, suffix } = splitPathSuffix(input);
  const sanitized = pathPart.replace(/\\/g, "/").replace(/\/+/g, "/");
  const hasLeadingSlash = sanitized.startsWith("/");
  const rawParts = sanitized.split("/");

  const parts = [];

  for (const part of rawParts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (parts.length > 0 && parts[parts.length - 1] !== "..") {
        parts.pop();
      } else if (!hasLeadingSlash) {
        parts.push("..");
      }

      continue;
    }

    parts.push(part);
  }

  const normalized = `${hasLeadingSlash ? "/" : ""}${parts.join("/")}`;
  return `${normalized || (hasLeadingSlash ? "/" : ".")}${suffix}`;
}

export function getDirectoryPath(filePath = "") {
  const { pathPart } = splitPathSuffix(normalizePath(filePath));

  if (!pathPart || !pathPart.includes("/")) {
    return ".";
  }

  return pathPart.slice(0, pathPart.lastIndexOf("/")) || ".";
}

export function isAbsoluteLikePath(path = "") {
  return /^(data:|blob:|https?:\/\/|file:\/\/|\/|#)/i.test(path);
}

export function resolveAssetPath(tourData, currentTourPath, assetPath = "") {
  if (!assetPath) {
    return "";
  }

  if (isAbsoluteLikePath(assetPath)) {
    return assetPath;
  }

  const normalizedAsset = normalizePath(assetPath);
  const tourFolder = normalizePath(tourData?.tourFolder || "");

  if (tourFolder) {
    if (
      normalizedAsset === tourFolder ||
      normalizedAsset.startsWith(`${tourFolder}/`)
    ) {
      return normalizedAsset;
    }

    return normalizePath(`${tourFolder}/${normalizedAsset}`);
  }

  return normalizePath(`${getDirectoryPath(currentTourPath)}/${normalizedAsset}`);
}

export function resolveLinkedTourPath(currentTourPath, linkedPath = "") {
  if (!linkedPath) {
    return "";
  }

  if (isAbsoluteLikePath(linkedPath)) {
    return linkedPath;
  }

  if (linkedPath.startsWith("./") || linkedPath.startsWith("../")) {
    return normalizePath(`${getDirectoryPath(currentTourPath)}/${linkedPath}`);
  }

  return normalizePath(linkedPath);
}

function validateTourData(tourData, sourcePath) {
  if (!tourData || typeof tourData !== "object") {
    throw new Error(`O JSON de "${sourcePath}" veio inválido.`);
  }

  if (!Array.isArray(tourData.scenes) || tourData.scenes.length === 0) {
    throw new Error(`O tour "${sourcePath}" não tem nenhuma cena.`);
  }

  const hasAnySceneId = tourData.scenes.every(
    (scene) => scene && typeof scene.id === "string" && scene.id.trim()
  );

  if (!hasAnySceneId) {
    throw new Error(`Tem cena sem "id" válido no tour "${sourcePath}".`);
  }
}

export async function loadTour(requestedTourPath = "tour.json") {
  const tourPath = normalizePath(requestedTourPath || "tour.json");
  const response = await fetch(tourPath, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `Não consegui carregar o tour em "${tourPath}" (HTTP ${response.status}).`
    );
  }

  const tourData = await response.json();
  validateTourData(tourData, tourPath);

  return {
    tourData,
    tourPath,
  };
}