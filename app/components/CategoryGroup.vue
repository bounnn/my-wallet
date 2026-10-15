<script setup lang="ts">
// One category on the home "By category" view: card with name, total, share bar; opens into its transactions.
// Rows show date (+ note when there is one) only, since the card header already shows the category.
const props = defineProps<{
  category?: Category;
  type: Transaction["type"];
  total: number;
  // Part of the month's expenses (or income), 0–1
  share: number;
  items: Transaction[];
  currency: string;
}>();
const open = defineModel<boolean>("open", { default: false });
// Tapping a transaction opens its details
defineEmits<{ select: [transaction: Transaction] }>();

const count = computed(() => props.items.length);

// Progress bar in the category color
const barTrack = computed(() => barTrackStyle(props.category?.color));
const barFill = computed(() => barFillStyle(props.category?.color, props.share, 4));
</script>

<template>
  <UCollapsible v-model:open="open" class="surface-card rounded-2xl">
    <button type="button" class="w-full p-4 text-left">
      <div class="flex items-center gap-3">
        <IconTile :icon="category?.icon ?? 'i-lucide-tag'" :color="category?.color" size="sm" />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3">
            <p class="truncate font-display font-bold tracking-tight text-highlighted">
              {{ category?.name ?? "Uncategorized" }}
            </p>
            <p
              class="shrink-0 font-display font-semibold tabular-nums"
              :class="type === 'income' ? 'text-success' : 'text-highlighted'"
            >
              {{ formatAmount(total, currency) }}
            </p>
          </div>
          <div class="mt-1 flex items-center justify-between gap-3 text-sm text-muted tabular-nums">
            <p>{{ Math.round(share * 100) }}% of {{ type === "income" ? "income" : "expenses" }}</p>
            <p class="flex shrink-0 items-center gap-1">
              {{ count }} {{ count === 1 ? "transaction" : "transactions" }}
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 text-dimmed transition-transform duration-200 motion-reduce:transition-none"
                :class="open && 'rotate-180'"
              />
            </p>
          </div>
        </div>
      </div>
      <div class="mt-4 h-3 overflow-hidden rounded-full" :style="barTrack">
        <div
          class="bar-grow h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          :style="barFill"
        />
      </div>
    </button>

    <template #content>
      <ul class="divide-y divide-default border-t border-default">
        <li v-for="t in items" :key="t.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-elevated/60"
            @click="$emit('select', t)"
          >
            <div class="min-w-0 flex-1">
              <p v-if="t.note" class="truncate font-medium text-highlighted">{{ t.note }}</p>
              <p :class="t.note ? 'text-sm text-muted' : 'font-medium text-highlighted'" class="tabular-nums">
                {{ weekdayLabel(t.date) }}
              </p>
            </div>
            <MoneyAmount
              :amount="t.type === 'income' ? t.amount : -t.amount"
              :currency="currency"
              signed
              hide-currency
              align="end"
              class="shrink-0"
              :amount-class="['font-semibold', t.type === 'income' ? 'text-success' : 'text-highlighted'].join(' ')"
            />
          </button>
        </li>
      </ul>
    </template>
  </UCollapsible>
</template>
