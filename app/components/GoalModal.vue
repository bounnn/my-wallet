<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, type DateValue } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";
import * as v from "valibot";

// Create a savings goal in `wallet`, or edit one when `goal` is given: name, target, optional due date, icon, color.
// Name, icon and color live on the goal's own expense category.
const props = defineProps<{ goal?: Goal; wallet?: Account }>();
const open = defineModel<boolean>("open", { required: true });

const { value: categories } = useLiveQuery(() => db.categories.where("type").equals("expense").toArray(), []);

const icons = [
  "i-lucide-piggy-bank", "i-lucide-house", "i-lucide-car", "i-lucide-plane",
  "i-lucide-palmtree", "i-lucide-graduation-cap", "i-lucide-heart-pulse", "i-lucide-baby",
  "i-lucide-smartphone", "i-lucide-laptop", "i-lucide-gift", "i-lucide-gem",
  "i-lucide-bike", "i-lucide-camera", "i-lucide-shield", "i-lucide-target",
  "i-lucide-briefcase", "i-lucide-paw-print",
];

const currency = computed(() => props.goal?.currency ?? props.wallet?.currency ?? "USD");
const state = reactive({
  name: "",
  target: "",
  icon: icons[0]!,
  color: DEFAULT_CATEGORY_COLOR,
});
// Optional, so nothing to validate; kept out of the form state, which would unwrap the CalendarDate class
const deadline = shallowRef<CalendarDate>();
const calendarOpen = ref(false);

const now = new Date();
const today = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
const isPastDay = (d: DateValue) => d.compare(today) <= 0;

// Fill the form each time it opens: the goal's values, or a blank goal
watch(open, (isOpen) => {
  if (!isOpen) return;
  const g = props.goal;
  const category = g && categories.value?.find((c) => c.id === g.categoryId);
  state.name = category?.name ?? "";
  state.target = g ? formatAmount(g.target, g.currency) : "";
  state.icon = category?.icon ?? icons[0]!;
  state.color = category?.color ?? DEFAULT_CATEGORY_COLOR;
  deadline.value = g?.deadline
    ? new CalendarDate(g.deadline.getFullYear(), g.deadline.getMonth() + 1, g.deadline.getDate())
    : undefined;
  calendarOpen.value = false;
});

function onPickDay(picked: unknown) {
  const value = calendarPick(picked);
  if (!value) return;
  deadline.value = new CalendarDate(value.year, value.month, value.day);
  calendarOpen.value = false;
}

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Give the goal a name"),
    v.maxLength(30, "Keep it under 30 characters"),
    // It shows up as a category, so it can't share a name with one
    v.check(
      (n) =>
        !(categories.value ?? []).some(
          (c) => !c.archived && c.id !== props.goal?.categoryId && c.name.toLowerCase() === n.toLowerCase(),
        ),
      "You already have a category with this name",
    ),
  ),
  target: v.pipe(
    v.string(),
    v.transform((text) => parseAmount(text, currency.value)),
    v.check((n: number) => Number.isFinite(n), "Enter a number"),
    v.minValue(1, "Enter a target above 0"),
  ),
  icon: v.string(),
  color: v.picklist(categoryColorKeys),
});

const toast = useToast();

async function save({ data }: FormSubmitEvent<v.InferOutput<typeof schema>>) {
  const category = { name: data.name, icon: data.icon, color: data.color };
  const fields = { target: data.target, deadline: deadline.value?.toDate(getLocalTimeZone()) };
  try {
    if (props.goal) await updateGoal(props.goal, category, fields);
    else if (props.wallet) await addGoal(props.wallet.id, category, fields);
    else throw new UserError("Add a wallet first");
    open.value = false;
  } catch (error) {
    toast.add({
      title: "Couldn't save the goal",
      description: errorText(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="goal ? 'Edit goal' : 'New goal'">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-5" @submit="save">
        <!-- One grouped card like the add screen: name (with a live icon preview), target, due date -->
        <div class="divide-y divide-default rounded-2xl bg-elevated">
          <FieldRow
            v-model="state.name"
            name="name"
            label="Name"
            placeholder="What are you saving for?"
            :maxlength="30"
            enterkeyhint="next"
          >
            <template #leading>
              <IconTile :icon="state.icon" :color="state.color" size="sm" />
            </template>
          </FieldRow>

          <AmountField v-model="state.target" name="target" label="Target" :currency="currency" />

          <!-- Optional due date; the calendar opens in place -->
          <div>
            <div class="flex h-12 items-center gap-3 px-4">
              <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-dimmed" />
              <span class="flex-1 text-sm text-muted">Due date</span>
              <button
                type="button"
                class="-my-1.5 h-11 rounded-full px-3.5 text-sm font-medium tabular-nums transition-colors"
                :class="deadline || calendarOpen ? 'bg-primary/20 text-navy-100' : 'bg-accented text-muted hover:text-toned'"
                :aria-expanded="calendarOpen"
                @click="calendarOpen = !calendarOpen"
              >
                {{ deadline ? formatDate(deadline.toDate(getLocalTimeZone())) : "None" }}
              </button>
              <button
                v-if="deadline"
                type="button"
                aria-label="Remove due date"
                class="-my-1.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-dimmed transition-colors hover:text-toned"
                @click="
                  deadline = undefined;
                  calendarOpen = false;
                "
              >
                <UIcon name="i-lucide-circle-x" class="size-5" />
              </button>
            </div>
            <UCalendar
              v-if="calendarOpen"
              :model-value="deadline"
              :is-date-disabled="isPastDay"
              class="mx-auto px-2 pb-3"
              @update:model-value="onPickDay"
            />
          </div>
        </div>

        <div>
          <p class="text-sm text-muted">Icon</p>
          <div class="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Icon">
            <button
              v-for="i in icons"
              :key="i"
              type="button"
              role="radio"
              :aria-checked="i === state.icon"
              :aria-label="i.replace('i-lucide-', '').replaceAll('-', ' ')"
              class="flex aspect-square items-center justify-center rounded-xl transition-colors"
              :class="i === state.icon ? 'bg-primary/20 text-navy-100' : 'text-muted hover:bg-elevated'"
              @click="state.icon = i"
            >
              <UIcon :name="i" class="size-5" />
            </button>
          </div>
        </div>

        <div>
          <p class="text-sm text-muted">Color</p>
          <ColorPicker v-model="state.color" />
        </div>

        <UButton
          type="submit"
          :label="goal ? 'Save goal' : 'Add goal'"
          size="xl"
          block
          loading-auto
          class="h-13 justify-center"
        />
      </UForm>
    </template>
  </UModal>
</template>
