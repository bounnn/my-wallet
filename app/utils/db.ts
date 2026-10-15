import Dexie, { type EntityTable } from "dexie";

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

export const db = new Dexie("my-wallet") as Dexie & {
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
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

// New databases skip upgrades, so seed them on creation
db.on("populate", (tx) => tx.table("categories").bulkAdd(defaultCategories));
