// Some file pickers return an empty or generic MIME type for local recordings.
const extensions = Object.freeze({
  image: ["jpg", "jpeg", "jfif", "png", "gif", "webp", "avif", "bmp", "svg", "heic", "heif"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "weba", "webm", "amr", "aif", "aiff"],
  video: ["mp4", "m4v", "webm", "mov", "ogv", "mkv", "avi", "3gp"],
});

export function fileAcceptList(kind) {
  return [kind + "/*", ...extensions[kind].map((ext) => "." + ext)].join(",");
}

export function matchesVisitorFile(file, kind) {
  if (!file?.size || !Object.hasOwn(extensions, kind)) return false;
  const mime = (file.type || "").toLowerCase();
  if (mime && mime !== "application/octet-stream" && mime !== "application/ogg") {
    return mime.startsWith(kind + "/");
  }
  const suffix = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extensions[kind].includes(suffix);
}

export function isVisitorAttachment(value) {
  return Boolean(value && Object.hasOwn(extensions, value.kind) &&
    typeof value.name === "string" && value.name &&
    Number.isSafeInteger(value.size) && value.size > 0 &&
    typeof value.url === "string" && value.url.startsWith("blob:"));
}
