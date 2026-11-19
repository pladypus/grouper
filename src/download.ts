// Saves a file the browser downloads (spec: export-import.md: Blob + object URL + `<a download>`).

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(fileName: string, text: string, type = "application/json"): void {
  downloadBlob(fileName, new Blob([text], { type }));
}
