// Send first-time users to create a wallet, and keep everyone else out of the welcome page
export default defineNuxtRouteMiddleware(async (to) => {
  const hasWallet = (await db.accounts.count()) > 0;

  if (!hasWallet && to.path !== "/welcome") {
    return navigateTo("/welcome", { replace: true });
  }
  if (hasWallet && to.path === "/welcome") {
    return navigateTo("/", { replace: true });
  }
});
