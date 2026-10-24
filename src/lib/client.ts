export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  // A host error page (a timeout, an outage) is text, not JSON; report it
  // plainly instead of a JSON parse error.
  const text = await res.text();
  let result: { error?: string };
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 504 || /timeout/i.test(text)
        ? "The server took too long to respond. Please retry."
        : "The server could not complete the request. Please retry.",
    );
  }
  if (!res.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
// Phones and tablets, including iPads that report themselves as a Mac.
export function isMobileDevice() {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}
// On a phone a PDF goes to the share sheet (Print, Files, WhatsApp): an app
// added to an iPhone's Home Screen opens a PDF link with no toolbar, so it
// could not be printed or even closed. Without file sharing it downloads.
export async function sharePdf(file: File) {
  let canShare = false;
  try {
    canShare = !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    canShare = false;
  }
  if (canShare) await navigator.share({ files: [file], title: file.name });
  else downloadBlob(file, file.name);
}
