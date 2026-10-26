// Opening a web link from the game. The RUN host offers no "open URL" call, so this clicks a real link (which counts as the
// player's own tap and opens a new tab where the page allows it) and also copies the address, so the player can paste it if nothing opened.
export async function openLink(url: string): Promise<{ copied: boolean }> {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch { /* the copy below is the fallback */ }
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch { /* clipboard is not always allowed in a frame */ }
  return { copied };
}
