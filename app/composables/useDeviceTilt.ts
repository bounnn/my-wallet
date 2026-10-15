import type { Ref } from "vue";

/**
 * Makes an element lean with the phone: writes `--tilt-x` / `--tilt-y` (-1..1, smoothed) on it, from the gyroscope,
 * or from the mouse on desktop. "Flat" is however the phone is being held, and it slowly follows a new grip so the
 * element settles back. iOS only allows the gyroscope after a tap (asked again on every page load), so the first
 * tap anywhere on the page asks for it. Needs https (or localhost). Stays still with reduced motion.
 */
export function useDeviceTilt(target: Ref<HTMLElement | null | undefined>) {
  // Degrees of phone tilt for a full lean
  const RANGE = 15;
  // How fast "flat" follows the grip, per reading (~60 a second): about 8 s to settle, so a tilt stays visible
  const SETTLE = 0.002;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));

  let goalX = 0;
  let goalY = 0;
  let x = 0;
  let y = 0;
  let frame = 0;
  let neutral: { beta: number; gamma: number } | undefined;
  let listening = false;
  let reduced = false;

  // Ease toward the goal each frame and stop once there
  function step() {
    x += (goalX - x) * 0.15;
    y += (goalY - y) * 0.15;
    const done = Math.abs(goalX - x) < 0.001 && Math.abs(goalY - y) < 0.001;
    if (done) {
      x = goalX;
      y = goalY;
    }
    target.value?.style.setProperty("--tilt-x", x.toFixed(3));
    target.value?.style.setProperty("--tilt-y", y.toFixed(3));
    frame = done ? 0 : requestAnimationFrame(step);
  }
  const schedule = () => (frame ||= requestAnimationFrame(step));

  function onOrientation(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return;
    neutral ??= { beta: e.beta, gamma: e.gamma };
    neutral.beta += (e.beta - neutral.beta) * SETTLE;
    neutral.gamma += (e.gamma - neutral.gamma) * SETTLE;
    goalX = clamp((e.gamma - neutral.gamma) / RANGE);
    goalY = clamp((e.beta - neutral.beta) / RANGE);
    schedule();
  }

  function onPointerMove(e: PointerEvent) {
    const rect = target.value?.getBoundingClientRect();
    if (e.pointerType !== "mouse" || !rect) return;
    goalX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1);
    goalY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1);
    schedule();
  }
  function onPointerLeave() {
    goalX = 0;
    goalY = 0;
    schedule();
  }

  type WithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
  const orientation = () =>
    typeof DeviceOrientationEvent === "undefined" ? undefined : (DeviceOrientationEvent as WithPermission);

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener("deviceorientation", onOrientation);
  }

  async function askPermission() {
    const api = orientation();
    if (reduced || listening || !api?.requestPermission) return;
    try {
      // Answered (allowed or denied): stop asking on every tap
      const answer = await api.requestPermission();
      document.removeEventListener("click", askPermission);
      if (answer === "granted") listen();
    } catch {
      // Not counted as a tap by iOS: try again on the next one
    }
  }

  onMounted(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    target.value?.addEventListener("pointermove", onPointerMove);
    target.value?.addEventListener("pointerleave", onPointerLeave);
    if (!window.isSecureContext) {
      if (import.meta.dev) console.warn("[useDeviceTilt] Phones only share motion over https (or localhost)");
      return;
    }
    // iOS asks on the first tap anywhere; Android and others need no permission
    if (orientation()?.requestPermission) document.addEventListener("click", askPermission);
    else if (orientation()) listen();
  });

  onBeforeUnmount(() => {
    document.removeEventListener("click", askPermission);
    window.removeEventListener("deviceorientation", onOrientation);
    target.value?.removeEventListener("pointermove", onPointerMove);
    target.value?.removeEventListener("pointerleave", onPointerLeave);
    cancelAnimationFrame(frame);
  });
}
