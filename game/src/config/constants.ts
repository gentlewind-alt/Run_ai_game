// Balance lives in public/data/content.json; engine settings in public/data/config.json.
export const BASE_W = 480;
export let W = BASE_W; // logical viewport width; RUN stays 16:9
export const H = 270;

let widthSet = false;

/** Android sets the landscape width once, before Phaser creates any scenes. */
export function setLogicalWidth(width: number): void {
  if (widthSet) return;
  W = Math.max(BASE_W, Math.round(width));
  widthSet = true;
}
