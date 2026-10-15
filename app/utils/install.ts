// The app only runs from the home screen; these tell whether it is, and which install steps fit this browser.

// Opened from the home screen: display-mode standalone, or iOS's own flag (older iOS has no display-mode)
export function isInstalledApp() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

// in-app: LINE, Facebook or Instagram's own browser, which can't install apps
// ios: Share → Add to Home Screen; prompt: Chrome-style install prompt (Android, desktop)
export type InstallPlatform = "in-app" | "ios" | "prompt";

export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/\bLine\/|FBAN|FBAV|FB_IAB|Instagram/i.test(ua)) return "in-app";
  // iPadOS reports itself as a Mac, but Macs have no touch screen
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "prompt";
}

// LINE opens a link in the phone's browser when it has ?openExternalBrowser=1
export const isLine = () => /\bLine\//i.test(navigator.userAgent);
