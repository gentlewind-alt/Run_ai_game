// A small password box over the game (a real HTML input, so phone keyboards and password managers work). Resolves the text, or null on cancel.
export function askAdminCode(): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);font:14px monospace';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1c2c;border:2px solid #41a6f6;padding:14px;border-radius:6px;color:#f4f4f4;display:flex;flex-direction:column;gap:8px;min-width:240px';
    const label = document.createElement('div');
    label.textContent = 'Admin code';
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.style.cssText = 'font:16px monospace;padding:6px;background:#0c0e1a;color:#fff;border:1px solid #566c86';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const done = (value: string | null): void => { wrap.remove(); resolve(value); };
    const mk = (text: string, f: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'font:14px monospace;padding:6px 12px;background:#29366f;color:#fff;border:1px solid #566c86;cursor:pointer';
      b.addEventListener('click', f);
      return b;
    };
    row.append(mk('Cancel', () => done(null)), mk('Unlock', () => done(input.value)));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') done(input.value);
      if (e.key === 'Escape') done(null);
    });
    box.append(label, input, row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    input.focus();
  });
}
