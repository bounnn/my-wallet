<script setup lang="ts">
// Asks before something that can't be undone (erasing data, restoring a backup, deleting a wallet).
// The destructive button is a quiet red, never the loudest one. With `backup`, the safe way out leads:
// "Back up first" saves a file and the dialog stays open.
defineProps<{ title: string; description: string; confirmLabel: string; loading?: boolean; backup?: boolean }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ confirm: [] }>();

const { backUp, saving, lastBackup } = useBackup();
// Backed up while this dialog was open
const openedAt = ref(0);
watch(open, (isOpen) => isOpen && (openedAt.value = Date.now()), { immediate: true });
const backedUp = computed(() => !!lastBackup.value && lastBackup.value.getTime() >= openedAt.value);
</script>

<template>
  <UModal v-model:open="open" :title="title" :close="false">
    <template #body>
      <div class="flex items-start gap-3">
        <IconTile icon="i-lucide-triangle-alert" color="error" size="sm" />
        <p class="text-muted">{{ description }}</p>
      </div>

      <UButton
        v-if="backup"
        :label="backedUp ? 'Backup saved' : 'Back up first'"
        :icon="backedUp ? 'i-lucide-circle-check' : 'i-lucide-download'"
        size="xl"
        block
        :loading="saving"
        :disabled="backedUp"
        class="mt-6 h-13 justify-center"
        @click="backUp"
      />

      <div class="flex gap-2" :class="backup ? 'mt-2' : 'mt-6'">
        <UButton label="Cancel" color="neutral" variant="soft" size="xl" class="h-13 flex-1 justify-center bg-elevated" @click="open = false" />
        <UButton
          :label="confirmLabel"
          color="error"
          variant="soft"
          size="xl"
          :loading="loading"
          class="h-13 flex-1 justify-center"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
