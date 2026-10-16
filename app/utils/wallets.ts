import { type Account, db } from "./db";
import { UserError } from "./error";

// Wallet reads and writes. Each write runs in one Dexie transaction, so a rule checked first still holds when it saves.

export type WalletFields = Pick<Account, "name" | "currency" | "initialBalance">;

// What a wallet holds besides its starting balance. Any of it locks the currency (amounts are stored in its
// minor units), and deleting the wallet takes all of it.
export async function walletUsage(id: number) {
  const [transactions, transfers, goals, budgets] = await Promise.all([
    db.transactions.where("accountId").equals(id).count(),
    walletTransfers(id).count(),
    db.goals.where("accountId").equals(id).count(),
    db.budgets.where("accountId").equals(id).count(),
  ]);
  return { transactions, transfers, goals, budgets };
}

// Transfers out of or into the wallet
const walletTransfers = (id: number) => db.transfers.where("fromAccountId").equals(id).or("toAccountId").equals(id);

// The main (first) wallet's currency, the default for a new one
export async function mainCurrency() {
  return (await db.accounts.orderBy("id").first())?.currency;
}

export function addWallet(fields: WalletFields) {
  return db.accounts.add({ ...fields, createdAt: new Date() });
}

export function updateWallet(id: number, fields: WalletFields) {
  return db.transaction("rw", [db.accounts, db.transactions, db.transfers, db.goals, db.budgets], async () => {
    const wallet = await db.accounts.get(id);
    if (!wallet) throw new UserError("This wallet was deleted");
    if (fields.currency !== wallet.currency && Object.values(await walletUsage(id)).some((n) => n > 0)) {
      throw new UserError("The currency can't change once a wallet has transactions, transfers, goals or budgets");
    }
    await db.accounts.update(id, fields);
  });
}

// Takes the wallet's transactions, transfers, goals and budgets with it. Its transfers also leave the other
// wallet's balance. Goals' categories are archived like a deleted goal's, so nothing else loses a name.
export function deleteWallet(id: number) {
  const tables = [db.accounts, db.transactions, db.transfers, db.goals, db.budgets, db.categories];
  return db.transaction("rw", tables, async () => {
    await walletTransfers(id).delete();
    const goals = await db.goals.where("accountId").equals(id).toArray();
    await db.categories.bulkUpdate(goals.map((g) => ({ key: g.categoryId, changes: { archived: true } })));
    await db.goals.bulkDelete(goals.map((g) => g.id));
    await db.budgets.where("accountId").equals(id).delete();
    await db.transactions.where("accountId").equals(id).delete();
    await db.accounts.delete(id);
  });
}
