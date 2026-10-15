<script setup lang="ts">
// A budget's month at a glance: what's left, the bar, and the expenses that used it; Edit opens the form
const props = defineProps<{
  name: string;
  spent: number;
  amount: number;
  color?: CategoryColor;
  currency: string;
  items: Transaction[];
  categoryById: Map<number, Category>;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ edit: [] }>();

const left = computed(() => props.amount - props.spent);
const used = computed(() => (props.amount ? props.spent / props.amount : 0));
// Show which category each expense is in only when the budget has more than one
const mixed = computed(() => new Set(props.items.map((t) => t.categoryId)).size > 1);
</script>

<template>
  <UModal v-model:open="open" :title="name">
    <template #body>
      <p class="flex flex-wrap items-baseline gap-x-2">
        <span
          class="font-display text-3xl font-bold tracking-tight tabular-nums"
          :class="left < 0 ? 'text-error' : 'text-highlighted'"
        >
          {{ formatAmount(Math.abs(left), currency) }}
        </span>
        <span class="text-sm text-muted">{{ left < 0 ? "over budget" : "left" }}</span>
        <span class="ml-auto rounded-md bg-elevated px-1.5 py-0.5 text-xs font-medium text-muted">{{ currency }}</span>
      </p>
      <div class="mt-3 h-3 overflow-hidden rounded-full" :style="barTrackStyle(color)">
        <div class="h-full rounded-full" :style="barFillStyle(color, Math.min(used, 1))" />
      </div>
      <p class="mt-2 text-sm text-muted tabular-nums">
        Spent <span class="font-medium text-toned">{{ formatAmount(spent, currency) }}</span>
        of {{ formatAmount(amount, currency) }}
      </p>

      <p v-if="!items.length" class="mt-5 rounded-2xl bg-elevated px-4 py-5 text-center text-sm text-muted">
        Nothing spent from this budget yet
      </p>
      <ul v-else class="mt-5 max-h-[45dvh] divide-y divide-default overflow-y-auto rounded-2xl bg-elevated">
        <li v-for="t in items" :key="t.id" class="flex items-center gap-3 px-4 py-3">
          <IconTile
            v-if="mixed"
            :icon="categoryById.get(t.categoryId)?.icon ?? 'i-lucide-tag'"
            :color="categoryById.get(t.categoryId)?.color"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-highlighted">
              {{ t.note || (mixed ? categoryById.get(t.categoryId)?.name : weekdayLabel(t.date)) }}
            </p>
            <p v-if="t.note || mixed" class="truncate text-sm text-muted tabular-nums">{{ weekdayLabel(t.date) }}</p>
          </div>
          <p class="shrink-0 font-semibold text-highlighted tabular-nums">-{{ formatAmount(t.amount, currency) }}</p>
        </li>
      </ul>

      <UButton
        label="Edit budget"
        icon="i-lucide-pencil"
        size="xl"
        block
        class="mt-5 h-13 justify-center"
        @click="emit('edit')"
      />
    </template>
  </UModal>
</template>
