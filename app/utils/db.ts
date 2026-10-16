import Dexie, { type EntityTable } from "dexie";
import { monthKey } from "./date";

export interface Account {
  id: number;
  name: string;
  currency: string;
  // Starting balance in minor units, like Transaction.amount
  initialBalance: number;
  createdAt: Date;
}

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  icon?: string;
  // Tint for the icon tile, bars and donut; its own palette, apart from the status colors
  color?: CategoryColor;
  // Hidden from pickers (a deleted goal's category); its transactions still show it
  archived?: boolean;
}

export const categoryColorKeys = [
  "blue", "sky", "teal", "green", "lime", "yellow", "orange", "red", "pink", "slate",
] as const;
export type CategoryColor = (typeof categoryColorKeys)[number];

// Before v7 categories used the status colors; maps those to the closest category color
export const legacyColors: Record<string, CategoryColor> = {
  primary: "blue",
  secondary: "teal",
  success: "green",
  info: "sky",
  warning: "orange",
  error: "red",
};

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number;
  type: "income" | "expense";
  // Stored in minor units (e.g. cents) to avoid floating point errors
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
}

// Money moved from one wallet to another. Kept apart from transactions, so it changes both balances
// without counting as income or expense (report, budgets and goals don't see it).
export interface Transfer {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  // Sent, in minor units of the sending wallet's currency
  amount: number;
  // Received, in minor units of the receiving wallet's currency (the same as amount when the currencies match)
  toAmount: number;
  // Exchange rate as typed: 1 unit of the sending currency = rate units of the receiving one. Only set
  // when the currencies differ.
  rate?: number;
  note?: string;
  date: Date;
  createdAt: Date;
}

// Savings goal in one wallet, backed by its own expense category (which holds the name, icon and color).
// Adding money is an expense in that category, taking it out an income, so
// saved = initialSaved + expenses - incomes in the goal's category, from the goal's wallet.
export interface Goal {
  id: number;
  accountId: number;
  categoryId: number;
  // The wallet's currency, which is locked while the wallet has goals
  currency: string;
  // Minor units, like Transaction.amount
  target: number;
  // Already saved before the goal was tracked (goals made before v4 keep their old total here)
  initialSaved: number;
  // Optional due date; with it the plan page shows whether saving is on schedule
  deadline?: Date;
  createdAt: Date;
}

// One wallet's spending limit for one month, shared by one or more expense categories, in the wallet's
// currency. A category is in at most one budget per wallet and month. Each month starts empty; last
// month's budgets can be copied in.
export interface Budget {
  id: number;
  accountId: number;
  // "YYYY-MM" (monthKey in utils/date.ts)
  month: string;
  // Shown on the card; falls back to the category names
  name?: string;
  categoryIds: number[];
  // Minor units
  amount: number;
  createdAt: Date;
}

// One day's transactions in a list, with its net total (minor units)
export interface TransactionDay {
  key: string;
  date: Date;
  label: string;
  total: number;
  items: (Transaction | Transfer)[];
}

export const db = new Dexie("my-wallet") as Dexie & {
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  goals: EntityTable<Goal, "id">;
  budgets: EntityTable<Budget, "id">;
  transfers: EntityTable<Transfer, "id">;
};

// Starter categories so a transaction can be added right after onboarding
export const defaultCategories: Omit<Category, "id">[] = [
  { name: "Food & drink", type: "expense", icon: "i-lucide-utensils", color: "orange" },
  { name: "Groceries", type: "expense", icon: "i-lucide-shopping-basket", color: "lime" },
  { name: "Transport", type: "expense", icon: "i-lucide-bus", color: "sky" },
  { name: "Shopping", type: "expense", icon: "i-lucide-shopping-bag", color: "pink" },
  { name: "Bills", type: "expense", icon: "i-lucide-receipt", color: "yellow" },
  { name: "Home", type: "expense", icon: "i-lucide-house", color: "blue" },
  { name: "Health", type: "expense", icon: "i-lucide-heart-pulse", color: "red" },
  { name: "Fun", type: "expense", icon: "i-lucide-ticket", color: "teal" },
  { name: "Other", type: "expense", icon: "i-lucide-ellipsis", color: "slate" },
  { name: "Salary", type: "income", icon: "i-lucide-briefcase", color: "green" },
  { name: "Business", type: "income", icon: "i-lucide-store", color: "teal" },
  { name: "Gift", type: "income", icon: "i-lucide-gift", color: "pink" },
  { name: "Interest", type: "income", icon: "i-lucide-trending-up", color: "lime" },
  { name: "Other", type: "income", icon: "i-lucide-ellipsis", color: "slate" },
];

// Only indexed fields are listed; bump the version when changing the schema
db.version(1).stores({
  accounts: "++id, name",
  categories: "++id, name, type",
  transactions: "++id, accountId, categoryId, type, date, [accountId+date]",
});

// v2: same schema, seeds the starter categories into databases created before they existed
db.version(2)
  .stores({
    accounts: "++id, name",
    categories: "++id, name, type",
    transactions: "++id, accountId, categoryId, type, date, [accountId+date]",
  })
  .upgrade(async (tx) => {
    if ((await tx.table("categories").count()) === 0) await tx.table("categories").bulkAdd(defaultCategories);
  });

// v3: savings goals and monthly category budgets (plan page); one budget per category
db.version(3).stores({
  goals: "++id",
  budgets: "++id, &categoryId",
});

// v4: goals become categories with transactions; budgets cover several categories
db.version(4)
  .stores({
    goals: "++id, &categoryId",
    budgets: "++id, *categoryIds",
  })
  .upgrade(async (tx) => {
    await tx
      .table("budgets")
      .toCollection()
      .modify((b) => {
        b.categoryIds = [b.categoryId];
        delete b.categoryId;
      });
    for (const g of await tx.table("goals").toArray()) {
      const categoryId = await tx
        .table("categories")
        .add({ name: g.name, type: "expense", icon: g.icon, color: g.color });
      await tx.table("goals").put({
        id: g.id,
        categoryId,
        currency: g.currency,
        target: g.target,
        initialSaved: g.saved,
        deadline: g.deadline,
        createdAt: g.createdAt,
      });
    }
  });

// v5: budgets belong to a month; existing ones go to the month they were made in
db.version(5)
  .stores({ budgets: "++id, month, *categoryIds" })
  .upgrade((tx) =>
    tx
      .table("budgets")
      .toCollection()
      .modify((b) => {
        b.month = monthKey(b.createdAt);
      }),
  );

// v6: goals and budgets belong to a wallet (categories stay shared). Goals go to the first wallet in their
// currency, budgets to the main (first) wallet, whose currency they were in.
db.version(6)
  .stores({
    goals: "++id, &categoryId, accountId",
    budgets: "++id, month, accountId, *categoryIds",
  })
  .upgrade(async (tx) => {
    const wallets: Account[] = await tx.table("accounts").orderBy("id").toArray();
    const main = wallets[0];
    if (!main) return;
    await tx
      .table("goals")
      .toCollection()
      .modify((g) => {
        g.accountId = (wallets.find((w) => w.currency === g.currency) ?? main).id;
      });
    await tx
      .table("budgets")
      .toCollection()
      .modify((b) => {
        b.accountId = main.id;
      });
  });

// v7: categories get their own color palette. Untouched starter categories take their new color (so Bills
// and Health, Shopping and Fun no longer share one); the rest map to the closest new color.
const oldStarterColors: Record<string, string> = {
  "expense:Food & drink": "warning",
  "expense:Groceries": "success",
  "expense:Transport": "info",
  "expense:Shopping": "secondary",
  "expense:Bills": "error",
  "expense:Home": "primary",
  "expense:Health": "error",
  "expense:Fun": "secondary",
  "expense:Other": "primary",
  "income:Salary": "success",
  "income:Business": "info",
  "income:Gift": "secondary",
  "income:Interest": "success",
  "income:Other": "primary",
};
db.version(7)
  .stores({})
  .upgrade((tx) =>
    tx
      .table("categories")
      .toCollection()
      .modify((c) => {
        const key = `${c.type}:${c.name}`;
        const starter = defaultCategories.find((d) => `${d.type}:${d.name}` === key);
        c.color =
          starter && oldStarterColors[key] === c.color ? starter.color : (legacyColors[c.color] ?? c.color ?? "blue");
      }),
  );

// v8: transfers between wallets
db.version(8).stores({ transfers: "++id, fromAccountId, toAccountId, date" });

// New databases skip upgrades, so seed them on creation
db.on("populate", (tx) => tx.table("categories").bulkAdd(defaultCategories));
