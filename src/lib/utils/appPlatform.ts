export type AppPlatform = 'android' | 'ios' | 'mac' | 'windows' | 'linux' | 'unknown';
export function detectAppPlatform({ userAgent, platform = '', maxTouchPoints = 0, standalone = false, nativeAndroid = false }: { userAgent: string; platform?: string; maxTouchPoints?: number; standalone?: boolean; nativeAndroid?: boolean }) {
  const os: AppPlatform = nativeAndroid || /Android/i.test(userAgent) ? 'android'
    : /iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints > 1) ? 'ios'
    : /Mac/i.test(platform + userAgent) ? 'mac'
    : /Win/i.test(platform + userAgent) ? 'windows'
    : /Linux/i.test(platform + userAgent) ? 'linux' : 'unknown';
  return { os, installed: nativeAndroid || standalone, nativeAndroid, canDownloadApk: os === 'android' && !nativeAndroid && !standalone };
}
