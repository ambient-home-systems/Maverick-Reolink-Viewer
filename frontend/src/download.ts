/** Save JSON as a file through a temporary object URL. */
export function downloadJson(data: unknown, filename: string, doc: Document = document): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  doc.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
