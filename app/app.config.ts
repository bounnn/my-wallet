export default defineAppConfig({
  ui: {
    colors: {
      primary: "navy",
      secondary: "cyan",
      neutral: "midnight",
      success: "emerald",
      warning: "amber",
      info: "sky",
      error: "rose",
    },

    // Plain dark card, no border glow (ref6)
    card: {
      slots: {
        root: "rounded-2xl",
        // Mobile-only: drop the default sm: padding so cards look the same on every screen
        header: () => "p-4",
        body: () => "p-4",
        footer: () => "p-4",
      },
      variants: {
        variant: {
          outline: { root: "bg-muted ring-0 divide-default" },
        },
      },
    },

    button: {
      slots: {
        base: "rounded-full font-semibold transition-[background-color,filter,transform] active:scale-[0.98] motion-reduce:active:scale-100",
      },
      compoundVariants: [
        // Primary: royal blue → deep navy gradient with white text (secondary buttons stay flat)
        { color: "primary", variant: "solid", class: "btn-primary-gradient text-white" },
        {
          color: "neutral",
          variant: ["outline", "subtle", "soft"],
          class: "bg-muted ring-0 text-highlighted hover:bg-elevated",
        },
      ],
    },

    input: {
      slots: { base: "rounded-xl" },
      variants: { variant: { outline: "bg-muted ring-0" } },
    },
    selectMenu: {
      slots: { base: "rounded-xl", content: "rounded-xl" },
      variants: { variant: { outline: "bg-muted ring-0" } },
    },

    tabs: {
      variants: {
        variant: {
          pill: {
            list: "bg-muted rounded-full",
            trigger: "rounded-full",
            indicator: "rounded-full",
          },
        },
      },
      compoundVariants: [{ variant: "pill", class: { trigger: "data-[state=active]:text-white" } }],
    },

    popover: { slots: { content: "rounded-xl" } },
    dropdownMenu: { slots: { content: "rounded-xl bg-elevated ring-default" } },
    toast: { slots: { root: "rounded-xl bg-elevated" } },

    drawer: {
      slots: { content: "bg-muted" },
      variants: { inset: { false: { content: "rounded-t-3xl" } } },
    },
    modal: {
      slots: {
        content: "bg-muted",
        header: () => "flex items-center gap-1.5 px-5 py-4 min-h-(--ui-header-height)",
        body: () => "flex-1 p-5",
        footer: () => "flex items-center gap-1.5 px-5 py-4",
      },
      variants: { fullscreen: { false: { content: "rounded-2xl ring-0" } } },
    },
  },
});
