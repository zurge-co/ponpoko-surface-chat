export async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "true");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(box);
  if (!copied) throw new Error("the clipboard refused the write");
}
