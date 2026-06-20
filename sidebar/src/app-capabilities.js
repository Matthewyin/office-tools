import { getHostAdapter } from './host-adapters/index.js';

export function getAppCapabilities(mode) {
  return getHostAdapter(mode).capabilities;
}

// 不同宿主共享同源 localStorage，按 app 模式加前缀避免相互覆盖。
export function scopedStorageKey(appMode, key) {
  if (appMode === 'office') return key;
  return `${appMode}_${key}`;
}
