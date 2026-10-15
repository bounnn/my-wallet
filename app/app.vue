<script setup lang="ts">
// Pages set their own title ("Report - My Wallet"); home has none, so it's just the app name
useHead({ titleTemplate: (title) => (title ? `${title} - My Wallet` : "My Wallet") });
</script>

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
