const KEY = 'shim-shim:v1';
export async function readState() {
  return window.localStorage.getItem(KEY);
}
export async function writeState(raw: string) {
  window.localStorage.setItem(KEY, raw);
}
