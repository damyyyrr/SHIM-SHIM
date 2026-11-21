import Storage from 'expo-sqlite/kv-store';
const KEY = 'shim-shim:v1';
export const readState = () => Storage.getItem(KEY);
export const writeState = (raw: string) => Storage.setItem(KEY, raw);
