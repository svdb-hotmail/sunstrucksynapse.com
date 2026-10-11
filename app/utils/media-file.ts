export function normalizeMediaMime(file: Pick<File, "name" | "type">): string {
  const aliases: Record<string, string> = {
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/x-m4a": "audio/mp4",
    "image/jpg": "image/jpeg",
    "audio/x-flac": "audio/flac",
  };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensions: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    flac: "audio/flac",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    webm: "audio/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
  };
  return (
    aliases[file.type] ??
    (file.type && file.type !== "application/octet-stream"
      ? file.type
      : (extensions[extension] ?? ""))
  );
}

export async function readMediaMetadata(file: File, kind: "audio" | "artwork") {
  const url = URL.createObjectURL(file);
  try {
    if (kind === "artwork") {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }
    const durationMs = await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      const timeout = window.setTimeout(
        () => finish(new Error("Audio metadata timed out. Try an MP3/M4A listening file.")),
        15000,
      );
      function finish(error?: Error) {
        window.clearTimeout(timeout);
        audio.removeAttribute("src");
        audio.load();
        if (error) reject(error);
      }
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration * 1000);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        if (!Number.isSafeInteger(duration) || duration < 1)
          finish(new Error("Cannot read a finite audio duration."));
        else {
          finish();
          resolve(duration);
        }
      };
      audio.onerror = () => finish(new Error("The browser cannot read this audio. Try MP3/M4A."));
      audio.src = url;
    });
    return { durationMs, codec: normalizeMediaMime(file).split("/")[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}
