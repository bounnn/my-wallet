<script setup lang="ts">
import * as v from "valibot";

definePageMeta({ layout: false });

// intro → 3 setup steps → done
const screens = ["intro", "name", "currency", "balance", "done"] as const;
const setupSteps = 3;
const screen = ref(0);
const current = computed(() => screens[screen.value]);
const direction = ref<"forward" | "back">("forward");

const name = ref("");
const currency = ref("USD");
const amountText = ref("");

// --- Name ---
const nameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Give your wallet a name"),
  v.maxLength(50, "Keep it under 50 characters"),
);
const nameError = ref<string>();
const nameSuggestions = ["Main Wallet", "Cash", "Bank account", "Savings"];

// --- Currency: search by code or name, selected one pinned on top ---
const currencies = currencyOptions();
const search = ref("");
const filteredCurrencies = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = q
    ? currencies.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    : currencies;
  const selected = list.find((c) => c.code === currency.value);
  return selected ? [selected, ...list.filter((c) => c !== selected)] : list;
});

// --- Balance ---
const digits = computed(() => currencyDigits(currency.value));
const balance = computed(() => {
  const n = Number.parseFloat(amountText.value);
  return toMinor(Number.isFinite(n) ? n : 0, currency.value);
});
const amountDisplay = computed(() => formatAmountInput(amountText.value));
watch(currency, () => (amountText.value = ""));

// --- Navigation ---
const saving = ref(false);
const toast = useToast();

function go(to: number) {
  direction.value = to > screen.value ? "forward" : "back";
  screen.value = to;
}

async function next() {
  if (current.value === "name") {
    const result = v.safeParse(nameSchema, name.value);
    nameError.value = result.success ? undefined : result.issues[0].message;
    if (!result.success) return;
    name.value = result.output;
  }
  if (current.value === "balance") {
    if (await create()) go(screen.value + 1);
    return;
  }
  if (current.value === "done") {
    await navigateTo("/", { replace: true });
    return;
  }
  go(screen.value + 1);
}

async function create() {
  saving.value = true;
  try {
    await db.accounts.add({
      name: name.value,
      currency: currency.value,
      initialBalance: balance.value,
      createdAt: new Date(),
    });
    return true;
  } catch (error) {
    toast.add({
      title: "Couldn't create your wallet",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
      icon: "i-lucide-circle-alert",
    });
    return false;
  } finally {
    saving.value = false;
  }
}

const buttonLabel = computed(
  () =>
    ({
      intro: "Get started",
      name: "Continue",
      currency: "Continue",
      balance: "Create wallet",
      done: "Open my wallet",
    })[current.value],
);

// `autofocus` only works on page load, so focus each step's input once it has animated in
function focusStep(el: Element) {
  el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
}
const transition = computed(() => (direction.value === "forward" ? "step-forward" : "step-back"));
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)]">
    <!-- Top bar during setup: back + progress -->
    <div v-if="screen >= 1 && screen <= setupSteps" class="flex h-12 items-center gap-3 px-4">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        class="-ml-2"
        @click="go(screen - 1)"
      />
      <div
        class="flex flex-1 gap-1.5"
        role="progressbar"
        :aria-valuenow="screen"
        aria-valuemin="1"
        :aria-valuemax="setupSteps"
      >
        <div
          v-for="i in setupSteps"
          :key="i"
          class="h-1 flex-1 rounded-full transition-colors duration-300"
          :class="i <= screen ? 'bg-primary' : 'bg-accented'"
        />
      </div>
      <span class="w-9 text-right text-sm tabular-nums text-dimmed">{{ screen }}/{{ setupSteps }}</span>
    </div>

    <form class="relative flex min-h-0 flex-1 flex-col" @submit.prevent="next">
      <Transition :name="transition" mode="out-in" appear @after-enter="focusStep">
        <!-- Intro: one slide, card as the hero visual -->
        <section v-if="current === 'intro'" key="intro" class="flex flex-1 flex-col px-6">
          <div class="relative flex flex-1 items-center justify-center" aria-hidden="true">
            <div class="absolute size-72 rounded-full bg-navy-600/30 blur-3xl" />
            <div class="hero-float w-[85%] [perspective:900px]">
              <WalletCard
                name="Main Wallet"
                currency="USD"
                :balance="1248000"
                class="[transform:rotateX(14deg)_rotateZ(-8deg)]"
              />
            </div>
            <div class="coin-float eth-coin absolute top-[18%] right-[8%] flex size-14 items-center justify-center rounded-full">
              <EthGlyph class="size-8" />
            </div>
            <div class="coin-float-slow eth-coin absolute bottom-[20%] left-[6%] flex size-9 items-center justify-center rounded-full">
              <EthGlyph class="size-5" />
            </div>
          </div>

          <div class="pb-2">
            <span class="inline-flex rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-toned">
              Private by design
            </span>
            <h1 class="mt-4 font-display text-[2rem] leading-tight font-bold tracking-tight text-highlighted">
              Your money,<br />only on your phone.
            </h1>
            <p class="mt-3 text-muted">
              No account, no cloud. Track income and spending on this device, fully offline.
            </p>
          </div>
        </section>

        <!-- Step 1: name -->
        <section v-else-if="current === 'name'" key="name" class="flex-1 px-6 pt-6">
          <h1 class="font-display text-[1.75rem] leading-tight font-bold tracking-tight text-highlighted">
            Name your wallet
          </h1>
          <p class="mt-2 text-muted">You can add more wallets later for cards, savings or cash.</p>

          <input
            v-model="name"
            type="text"
            placeholder="e.g. Main Wallet"
            maxlength="50"
            data-autofocus
            autocomplete="off"
            enterkeyhint="next"
            aria-label="Wallet name"
            :aria-invalid="!!nameError"
            class="mt-10 w-full border-b border-accented bg-transparent pb-3 font-display text-2xl font-semibold text-highlighted outline-none transition-colors placeholder:font-normal placeholder:text-dimmed focus:border-primary"
            @input="nameError = undefined"
          />
          <p v-if="nameError" class="mt-2 text-sm text-error">{{ nameError }}</p>

          <div class="mt-6 flex flex-wrap gap-2">
            <UButton
              v-for="suggestion in nameSuggestions"
              :key="suggestion"
              :label="suggestion"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="(name = suggestion), (nameError = undefined)"
            />
          </div>
        </section>

        <!-- Step 2: currency -->
        <section v-else-if="current === 'currency'" key="currency" class="flex min-h-0 flex-1 flex-col pt-6">
          <div class="px-6">
            <h1 class="font-display text-[1.75rem] leading-tight font-bold tracking-tight text-highlighted">
              Choose a currency
            </h1>
            <p class="mt-2 text-muted">All amounts in {{ name }} will use this currency.</p>
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search currency"
              size="lg"
              class="mt-6 w-full"
              aria-label="Search currency"
            />
          </div>

          <ul class="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4" role="listbox" aria-label="Currencies">
            <li v-for="c in filteredCurrencies" :key="c.code">
              <button
                type="button"
                role="option"
                :aria-selected="c.code === currency"
                class="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted"
                :class="c.code === currency && 'bg-muted'"
                @click="currency = c.code"
              >
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated font-display text-sm font-semibold text-highlighted"
                >
                  {{ c.symbol.length <= 2 ? c.symbol : c.code.slice(0, 1) }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold text-highlighted">{{ c.code }}</span>
                  <span class="block truncate text-sm text-muted">{{ c.name }}</span>
                </span>
                <UIcon v-if="c.code === currency" name="i-lucide-circle-check" class="size-5 text-primary" />
              </button>
            </li>
            <li v-if="!filteredCurrencies.length" class="px-3 py-6 text-center text-muted">
              No currency matches “{{ search }}”
            </li>
          </ul>
        </section>

        <!-- Step 3: starting balance with in-app keypad -->
        <section v-else-if="current === 'balance'" key="balance" class="flex min-h-0 flex-1 flex-col px-6 pt-6">
          <h1 class="font-display text-[1.75rem] leading-tight font-bold tracking-tight text-highlighted">
            Starting balance
          </h1>
          <p class="mt-2 text-muted">How much is in {{ name }} right now? Leave it at 0 to start fresh.</p>

          <div class="flex flex-1 flex-col items-center justify-center py-4">
            <p
              class="flex max-w-full items-baseline gap-2 font-display font-bold tracking-tight tabular-nums"
              aria-live="polite"
            >
              <span class="text-3xl text-dimmed">{{ currencySymbol(currency) }}</span>
              <span
                class="truncate text-highlighted"
                :class="amountDisplay.length > 9 ? 'text-4xl' : 'text-5xl'"
              >{{ amountDisplay }}</span>
            </p>
            <span class="mt-3 flex items-center gap-2 rounded-full bg-muted py-1 pr-1.5 pl-3 text-sm text-muted">
              {{ name }}
              <span class="rounded-full bg-elevated px-2 py-0.5 text-xs font-medium text-toned">{{ currency }}</span>
            </span>
          </div>

          <AmountKeypad v-model="amountText" :decimals="digits" class="-mx-2 mb-2" />
        </section>

        <!-- Done: the wallet card lands -->
        <section v-else key="done" class="flex flex-1 flex-col px-6">
          <div class="flex flex-1 items-center">
            <WalletCard :name="name" :currency="currency" :balance="balance" class="card-land" />
          </div>
          <div class="pb-2">
            <span class="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <UIcon name="i-lucide-check" class="size-3.5" /> Wallet created
            </span>
            <h1 class="mt-4 font-display text-[2rem] leading-tight font-bold tracking-tight text-highlighted">
              You're all set.
            </h1>
            <p class="mt-3 text-muted">Start adding income and expenses to see where your money goes.</p>
          </div>
        </section>
      </Transition>

      <!-- Primary action pinned within thumb reach -->
      <div class="px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <UButton type="submit" :label="buttonLabel" size="xl" block :loading="saving" class="h-14 justify-center" />
      </div>
    </form>
  </div>
</template>

<style scoped>
.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.step-forward-enter-from,
.step-back-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.step-forward-leave-to,
.step-back-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

/* Intro hero: card and coins float gently */
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

/* Done: card drops into place */
.card-land {
  animation: land 600ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
@keyframes land {
  from {
    opacity: 0;
    transform: translateY(-40px) scale(0.92) rotate(-4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-active,
  .step-forward-leave-active,
  .step-back-enter-active,
  .step-back-leave-active {
    transition: opacity 120ms ease;
  }
  .step-forward-enter-from,
  .step-forward-leave-to,
  .step-back-enter-from,
  .step-back-leave-to {
    transform: none;
  }
  .hero-float,
  .coin-float,
  .coin-float-slow,
  .card-land {
    animation: none;
  }
}
</style>
