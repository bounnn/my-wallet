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
  // Tint for the icon tile, one of the app's semantic colors
  color?: CategoryColor;
  // Hidden from pickers (a deleted goal's category); its transactions still show it
  archived?: boolean;
}

export type CategoryColor = "primary" | "secondary" | "success" | "info" | "warning" | "error";

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
  items: Transaction[];
}

export const db = new Dexie("my-wallet") as Dexie & {
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  goals: EntityTable<Goal, "id">;
  budgets: EntityTable<Budget, "id">;
};

// Starter categories so a transaction can be added right after onboarding
export const defaultCategories: Omit<Category, "id">[] = [
  { name: "Food & drink", type: "expense", icon: "i-lucide-utensils", color: "warning" },
  { name: "Groceries", type: "expense", icon: "i-lucide-shopping-basket", color: "success" },
  { name: "Transport", type: "expense", icon: "i-lucide-bus", color: "info" },
  { name: "Shopping", type: "expense", icon: "i-lucide-shopping-bag", color: "secondary" },
  { name: "Bills", type: "expense", icon: "i-lucide-receipt", color: "error" },
  { name: "Home", type: "expense", icon: "i-lucide-house", color: "primary" },
  { name: "Health", type: "expense", icon: "i-lucide-heart-pulse", color: "error" },
  { name: "Fun", type: "expense", icon: "i-lucide-ticket", color: "secondary" },
  { name: "Other", type: "expense", icon: "i-lucide-ellipsis", color: "primary" },
  { name: "Salary", type: "income", icon: "i-lucide-briefcase", color: "success" },
  { name: "Business", type: "income", icon: "i-lucide-store", color: "info" },
  { name: "Gift", type: "income", icon: "i-lucide-gift", color: "secondary" },
  { name: "Interest", type: "income", icon: "i-lucide-trending-up", color: "success" },
  { name: "Other", type: "income", icon: "i-lucide-ellipsis", color: "primary" },
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

// New databases skip upgrades, so seed them on creation
db.on("populate", (tx) => tx.table("categories").bulkAdd(defaultCategories));
