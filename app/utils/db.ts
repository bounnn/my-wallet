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

// Only indexed fields are listed; bump the version when changing the schema
db.version(1).stores({
  accounts: "++id, name",
  categories: "++id, name, type",
  transactions: "++id, accountId, categoryId, type, date, [accountId+date]",
});
