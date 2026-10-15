<script setup lang="ts">
// Asks before something that can't be undone (erasing data, restoring a backup, deleting a wallet)
defineProps<{ title: string; description: string; confirmLabel: string; loading?: boolean }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <UModal v-model:open="open" :title="title" :close="false">
    <template #body>
      <div class="flex items-start gap-3">
        <IconTile icon="i-lucide-triangle-alert" color="error" size="sm" />
        <p class="text-muted">{{ description }}</p>
      </div>

      <div class="mt-6 flex gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" size="xl" class="h-13 flex-1 justify-center bg-elevated" @click="open = false" />
        <UButton
          :label="confirmLabel"
          color="error"
          size="xl"
          :loading="loading"
          class="h-13 flex-1 justify-center"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
