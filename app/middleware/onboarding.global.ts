// Keep the app to the home screen, then send first-time users to create a wallet and keep everyone else out of
// the welcome page
export default defineNuxtRouteMiddleware(async (to) => {
  // In dev the gate is off so the app can be worked on in a browser tab
  if (!import.meta.dev) {
    const installed = isInstalledApp();
    if (!installed && to.path !== "/install") {
      return navigateTo("/install", { replace: true });
    }
    if (installed && to.path === "/install") {
      return navigateTo("/", { replace: true });
    }
  }
  if (to.path === "/install") return;

  const hasWallet = (await db.accounts.count()) > 0;

  if (!hasWallet && to.path !== "/welcome") {
    return navigateTo("/welcome", { replace: true });
  }
  if (hasWallet && to.path === "/welcome") {
    return navigateTo("/", { replace: true });
  }
});
