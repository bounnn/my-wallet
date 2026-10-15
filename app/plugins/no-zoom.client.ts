// iOS Safari ignores user-scalable=no and still pinch-zooms; its own gesture events can be cancelled instead.
// (Other browsers are covered by the viewport meta and touch-action in main.css.)
export default defineNuxtPlugin(() => {
  const block = (event: Event) => event.preventDefault();
  for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(name, block, { passive: false });
  }
});
