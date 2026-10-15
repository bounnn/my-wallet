<template>
  <UApp>
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />
    <!-- Mobile-only layout: larger screens get a centered phone-width column -->
    <div class="mx-auto min-h-dvh w-full max-w-md">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>
