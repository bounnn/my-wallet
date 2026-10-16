import * as v from "valibot";
import { formatDate } from "./date";
import { UserError } from "./error";
import { type CategoryColor, categoryColorKeys, db, defaultCategories, legacyColors } from "./db";

// Backup file: every table as JSON (dates become ISO strings), restored by replacing all data.
// Bump `version` if the shape changes, and keep reading older ones.
// v2: goals and budgets have a wallet (accountId); v1 files get one on restore, like the db's v6 upgrade.
// v3: transfers between wallets; older files have none.
const BACKUP_VERSION = 3;

const tables = () => [db.accounts, db.categories, db.transactions, db.goals, db.budgets, db.transfers];

export async function exportBackup() {
  const [accounts, categories, transactions, goals, budgets, transfers] = await Promise.all(
    tables().map((t) => t.toArray()),
  );
  return {
    app: "my-wallet",
    version: BACKUP_VERSION,
    exportedAt: new Date(),
    data: { accounts, categories, transactions, goals, budgets, transfers },
  };
}

// Saves the backup: the share sheet on phones (iOS home-screen apps can't download), a download elsewhere
export async function saveBackup() {
  const backup = await exportBackup();
  const name = `my-wallet-${formatDate(backup.exportedAt).split("/").reverse().join("-")}.json`;
  const file = new File([JSON.stringify(backup)], name, { type: "application/json" });

  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      // Closing the share sheet isn't an error
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// --- Reading a backup back ---

const date = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => new Date(value)),
  v.check((d) => !Number.isNaN(d.getTime()), "Invalid date"),
);
const id = v.pipe(v.number(), v.integer());
const minor = v.pipe(v.number(), v.integer());
// Older backups use the status color names, which map to the category palette (like the db's v7 upgrade)
const color = v.optional(
  v.pipe(
    v.picklist([...categoryColorKeys, ...(Object.keys(legacyColors) as (keyof typeof legacyColors)[])]),
    v.transform((c): CategoryColor => legacyColors[c] ?? (c as CategoryColor)),
  ),
);
const type = v.picklist(["income", "expense"]);

const backupSchema = v.object({
  app: v.literal("my-wallet"),
  version: v.pipe(v.number(), v.maxValue(BACKUP_VERSION, "Made by a newer version of the app")),
  exportedAt: date,
  data: v.object({
    accounts: v.array(
      v.object({ id, name: v.string(), currency: v.string(), initialBalance: minor, createdAt: date }),
    ),
    categories: v.array(
      v.object({ id, name: v.string(), type, icon: v.optional(v.string()), color, archived: v.optional(v.boolean()) }),
    ),
    transactions: v.array(
      v.object({
        id,
        accountId: id,
        categoryId: id,
        type,
        amount: minor,
        note: v.optional(v.string()),
        date,
        createdAt: date,
      }),
    ),
    goals: v.array(
      v.object({
        id,
        accountId: v.optional(id),
        categoryId: id,
        currency: v.string(),
        target: minor,
        initialSaved: minor,
        deadline: v.optional(date),
        createdAt: date,
      }),
    ),
    budgets: v.array(
      v.object({
        id,
        accountId: v.optional(id),
        month: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}$/)),
        name: v.optional(v.string()),
        categoryIds: v.array(id),
        amount: minor,
        createdAt: date,
      }),
    ),
    transfers: v.optional(
      v.array(
        v.object({
          id,
          fromAccountId: id,
          toAccountId: id,
          amount: minor,
          toAmount: minor,
          rate: v.optional(v.pipe(v.number(), v.minValue(0))),
          note: v.optional(v.string()),
          date,
          createdAt: date,
        }),
      ),
      [],
    ),
  }),
});

export type Backup = v.InferOutput<typeof backupSchema>;

// Parses a backup file's text; throws a readable message when it isn't one
export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UserError("This file isn't a My Wallet backup");
  }
  const result = v.safeParse(backupSchema, json);
  if (!result.success) {
    const issue = result.issues[0];
    throw new UserError(
      issue.message === "Made by a newer version of the app"
        ? "This backup was made by a newer version of the app"
        : "This file isn't a My Wallet backup, or it's damaged",
    );
  }
  if (!result.output.data.accounts.length) throw new UserError("This backup has no wallets");
  return result.output;
}

// Replaces everything on this device with the backup
export async function restoreBackup(backup: Backup) {
  const { accounts, categories, transactions, transfers } = backup.data;
  // v1 backups: goals go to the first wallet in their currency, budgets to the main wallet
  const main = accounts[0]!;
  const goals = backup.data.goals.map((g) => ({
    ...g,
    accountId: g.accountId ?? (accounts.find((w) => w.currency === g.currency) ?? main).id,
  }));
  const budgets = backup.data.budgets.map((b) => ({ ...b, accountId: b.accountId ?? main.id }));
  await db.transaction("rw", tables(), async () => {
    await Promise.all(tables().map((t) => t.clear()));
    await db.accounts.bulkAdd(accounts);
    await db.categories.bulkAdd(categories);
    await db.transactions.bulkAdd(transactions);
    await db.goals.bulkAdd(goals);
    await db.budgets.bulkAdd(budgets);
    await db.transfers.bulkAdd(transfers);
  });
}

// Deletes all data; the starter categories come back so a new wallet is ready to use
export async function eraseAllData() {
  await db.transaction("rw", tables(), async () => {
    await Promise.all(tables().map((t) => t.clear()));
    await db.categories.bulkAdd(defaultCategories);
  });
}
