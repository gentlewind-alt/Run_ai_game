// A small text box over the game (a real HTML input, so phone keyboards work). Resolves the text, or null on cancel.
export const askAdminCode = (): Promise<string | null> => askText('Admin code', { secret: true });

export function askText(title: string, opts: { secret?: boolean; initial?: string; ok?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);font:14px monospace';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1c2c;border:2px solid #41a6f6;padding:14px;border-radius:6px;color:#f4f4f4;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;min-width:0;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto';
    const label = document.createElement('div');
    label.textContent = title;
    const input = document.createElement('input');
    input.type = opts.secret ? 'password' : 'text';
    input.autocomplete = 'off';
    input.maxLength = 40;
    input.value = opts.initial ?? '';
    input.style.cssText = 'font:16px monospace;padding:6px;background:#0c0e1a;color:#fff;border:1px solid #566c86;min-width:0';
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
    row.append(mk('Cancel', () => done(null)), mk(opts.ok ?? 'OK', () => done(input.value)));
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
