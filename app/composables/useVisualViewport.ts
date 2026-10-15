/**
 * Size and offset of the visible area. When the on-screen keyboard opens, iOS shrinks this
 * instead of the page, so pinning a screen to it keeps bottom actions above the keyboard.
 */
export function useVisualViewport() {
  const height = ref<number>();
  const offsetTop = ref(0);

  function update() {
    const vv = window.visualViewport;
    if (!vv) return;
    height.value = vv.height;
    offsetTop.value = vv.offsetTop;
  }

  onMounted(() => {
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
  });
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
  });

  return { height, offsetTop };
}
