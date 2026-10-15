<script setup lang="ts">
definePageMeta({ layout: false });
useHead({ title: "Install" });

// The middleware sends every browser tab here: the app only runs from the home screen
const platform = installPlatform();
const { $pwa } = useNuxtApp();
const logo = `${useRuntimeConfig().app.baseURL}logo.svg`;
const toast = useToast();

// --- Android / desktop: the browser's own install prompt ---
// Set once the app is added, from the prompt or the browser menu
const installed = ref(false);
const markInstalled = () => (installed.value = true);
onMounted(() => window.addEventListener("appinstalled", markInstalled));
onBeforeUnmount(() => window.removeEventListener("appinstalled", markInstalled));

// Without a prompt (not offered yet, already installed, or a browser that has none) the menu steps show instead
const canPrompt = computed(() => !!$pwa?.showInstallPrompt);
async function install() {
  const choice = await $pwa?.install();
  if (choice?.outcome === "accepted") installed.value = true;
}

// --- iPhone: Safari keeps its own storage, so the home screen app starts empty ---
const hasData = ref(false);
onMounted(async () => {
  if (platform === "ios") hasData.value = (await db.accounts.count()) > 0;
});
const { saving, backUp } = useBackup();

// --- In-app browsers: hand the link to the real browser ---
const line = isLine();
const copied = ref(false);
async function openOutside() {
  if (line) {
    const url = new URL(location.href);
    url.searchParams.set("openExternalBrowser", "1");
    location.href = url.toString();
    return;
  }
  try {
    await navigator.clipboard.writeText(location.origin + useRuntimeConfig().app.baseURL);
    copied.value = true;
  } catch {
    toast.add({
      title: "Couldn't copy the link",
      description: "Copy it from the address bar instead",
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}

type Step = { icon: string; title: string; text?: string };
const steps = computed<Step[]>(() => {
  if (platform === "in-app") {
    return [
      { icon: "i-lucide-ellipsis", title: "Tap the menu", text: "The ⋯ button, usually in a top or bottom corner" },
      { icon: "i-lucide-compass", title: "Choose Open in browser", text: "It may say Open in Safari, or Open in Chrome" },
      { icon: "i-lucide-square-plus", title: "Add it to your home screen", text: "This page shows you how" },
    ];
  }
  if (platform === "ios") {
    return [
      { icon: "i-lucide-share", title: "Tap Share", text: "In Safari's toolbar. If you only see ⋯, tap it first." },
      { icon: "i-lucide-square-plus", title: "Choose Add to Home Screen", text: "Scroll down the list if you don't see it" },
      { icon: "i-lucide-circle-check", title: "Tap Add", text: "Then open My Wallet from your home screen" },
    ];
  }
  return [
    { icon: "i-lucide-ellipsis-vertical", title: "Open the browser menu", text: "⋮ in Chrome, at the top right" },
    { icon: "i-lucide-square-plus", title: "Tap Install app", text: "Or Add to Home screen" },
    { icon: "i-lucide-smartphone", title: "Open My Wallet from your home screen" },
  ];
});
const showSteps = computed(() => !installed.value && !(platform === "prompt" && canPrompt.value));

const copy = computed(() => {
  if (installed.value) {
    return { tag: "Installed", title: "Open My Wallet from your home screen.", text: "You can close this tab now." };
  }
  if (platform === "in-app") {
    return {
      tag: "Open in your browser",
      title: "This app can't be added from here.",
      text: "Open the link in Safari or Chrome to add My Wallet to your home screen.",
    };
  }
  return {
    tag: "One step left",
    title: "Add My Wallet to your home screen.",
    text: "It opens like an app, works offline, and keeps your money on this phone only.",
  };
});
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)]">
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
      <!-- Hero: the icon that lands on the home screen -->
      <div
        class="relative flex shrink-0 items-center justify-center"
        :class="showSteps ? 'h-48' : 'min-h-56 flex-1'"
        aria-hidden="true"
      >
        <div class="absolute size-56 rounded-full bg-navy-600/30 blur-3xl" />
        <div class="relative" :class="installed ? 'icon-land' : 'hero-float'">
          <img :src="logo" alt="" class="size-24 rounded-[22%] shadow-2xl shadow-black/50" />
          <span
            v-if="installed"
            class="absolute -right-2 -bottom-2 flex size-9 items-center justify-center rounded-full bg-success text-white ring-4 ring-(--ui-bg)"
          >
            <UIcon name="i-lucide-check" class="size-5" />
          </span>
        </div>
        <div class="coin-float metal-coin absolute top-[14%] right-[14%] flex size-11 items-center justify-center rounded-full">
          <SparkGlyph class="size-6" />
        </div>
        <div class="coin-float-slow metal-coin absolute bottom-[12%] left-[12%] flex size-8 items-center justify-center rounded-full">
          <SparkGlyph class="size-4" />
        </div>
      </div>

      <div class="pb-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
          :class="installed ? 'bg-success/10 text-success' : 'bg-elevated text-toned'"
        >
          <UIcon v-if="installed" name="i-lucide-check" class="size-3.5" />
          {{ copy.tag }}
        </span>
        <h1 class="mt-4 font-display text-[2rem] leading-tight font-bold tracking-tight text-highlighted">
          {{ copy.title }}
        </h1>
        <p class="mt-3 text-muted">{{ copy.text }}</p>
      </div>

      <ol v-if="showSteps" class="surface-card mt-6 divide-y divide-default rounded-2xl" aria-label="How to install">
        <li v-for="(step, i) in steps" :key="step.title" class="flex items-center gap-3 p-4">
          <IconTile :icon="step.icon" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">
              <span class="text-dimmed tabular-nums">{{ i + 1 }}.</span> {{ step.title }}
            </p>
            <p v-if="step.text" class="mt-0.5 text-sm text-muted">{{ step.text }}</p>
          </div>
        </li>
      </ol>

      <p v-if="showSteps && platform === 'prompt'" class="mt-3 text-sm text-muted">
        Already installed? Open it from your home screen.
      </p>

      <!-- iPhone: data saved in Safari doesn't carry over to the home screen app -->
      <div v-if="platform === 'ios' && hasData" class="surface-card mt-3 rounded-2xl p-4">
        <div class="flex gap-3">
          <IconTile icon="i-lucide-hard-drive-download" color="warning" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">Your data is in Safari</p>
            <p class="mt-0.5 text-sm text-muted">
              The home screen app starts empty. Back up here, then restore the file in the app from Settings.
            </p>
          </div>
        </div>
        <UButton
          label="Back up data"
          icon="i-lucide-download"
          color="neutral"
          variant="subtle"
          size="lg"
          block
          :loading="saving"
          class="mt-4 h-11"
          @click="backUp"
        />
      </div>
    </main>

    <!-- Primary action pinned within thumb reach (iPhone has nothing to tap here) -->
    <div
      v-if="(platform === 'prompt' && canPrompt && !installed) || platform === 'in-app'"
      class="px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
    >
      <UButton
        v-if="platform === 'prompt'"
        label="Install app"
        icon="i-lucide-download"
        size="xl"
        block
        loading-auto
        class="h-14 justify-center"
        @click="install"
      />
      <UButton
        v-else
        :label="line ? 'Open in browser' : copied ? 'Link copied' : 'Copy link'"
        :icon="line ? 'i-lucide-external-link' : copied ? 'i-lucide-check' : 'i-lucide-link'"
        size="xl"
        block
        class="h-14 justify-center"
        @click="openOutside"
      />
    </div>
    <div v-else class="pb-[max(env(safe-area-inset-bottom),1rem)]" />
  </div>
</template>

<style scoped>
.hero-float {
  animation: float 6s ease-in-out infinite;
}
.coin-float {
  animation: float 4.5s ease-in-out infinite;
}
.coin-float-slow {
  animation: float 7s ease-in-out infinite reverse;
}
@keyframes float {
  50% {
    transform: translateY(-10px);
  }
}

/* Installed: the icon drops into place */
.icon-land {
  animation: land 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes land {
  from {
    opacity: 0;
    transform: translateY(-40px) scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-float,
  .coin-float,
  .coin-float-slow,
  .icon-land {
    animation: none;
  }
}
</style>
