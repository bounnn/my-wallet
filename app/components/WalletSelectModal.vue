<script setup lang="ts">
// Pick one wallet from a list; closes on pick. `manage` adds a row to the settings page.
defineProps<{ wallets: Account[]; selectedId?: number; manage?: boolean }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ select: [wallet: Account] }>();

function pick(w: Account) {
  emit("select", w);
  open.value = false;
}

function goManage() {
  open.value = false;
  navigateTo("/settings");
}
</script>

<template>
  <UModal v-model:open="open" title="Wallet">
    <template #body>
      <ul class="max-h-[60dvh] divide-y divide-default overflow-y-auto rounded-2xl bg-elevated" role="radiogroup" aria-label="Wallet">
        <li v-for="w in wallets" :key="w.id">
          <button
            type="button"
            role="radio"
            :aria-checked="w.id === selectedId"
            class="flex w-full items-center gap-3 px-4 py-3 text-left"
            @click="pick(w)"
          >
            <IconTile icon="i-lucide-wallet" :color="w.id === selectedId ? 'primary' : 'info'" size="sm" />
            <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{ w.name }}</span>
            <span class="shrink-0 rounded-md bg-accented px-1.5 py-0.5 text-xs font-medium text-toned">{{ w.currency }}</span>
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
              :class="w.id === selectedId ? 'btn-primary-gradient text-white' : 'border-2 border-accented'"
            >
              <UIcon v-if="w.id === selectedId" name="i-lucide-check" class="size-3.5" />
            </span>
          </button>
        </li>
      </ul>

      <UButton
        v-if="manage"
        label="Manage wallets"
        icon="i-lucide-settings-2"
        color="neutral"
        variant="soft"
        size="xl"
        block
        class="mt-5 h-13 justify-center bg-elevated"
        @click="goManage"
      />
    </template>
  </UModal>
</template>
