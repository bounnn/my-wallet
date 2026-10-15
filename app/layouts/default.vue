<template>
  <div class="pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <slot />
  </div>
  <BottomNav @add="navigateTo('/add')" />
</template>
