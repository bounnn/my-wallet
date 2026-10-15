import { db, type Account, type Goal, type Transaction } from "./db";

// Saved toward a goal: its starting amount, plus money added (expenses in its category) minus money taken out
// (incomes), from wallets in the goal's currency
export function goalSaved(goal: Goal, transactions: Transaction[], walletById: Map<number, Account>) {
  let saved = goal.initialSaved;
  for (const t of transactions) {
    if (t.categoryId !== goal.categoryId || walletById.get(t.accountId)?.currency !== goal.currency) continue;
    saved += t.type === "expense" ? t.amount : -t.amount;
  }
  return saved;
}

// Same, read from the database for a check before editing or deleting one of the goal's transactions,
// which is left out (`withoutId`)
export async function loadGoalSaved(goal: Goal, withoutId?: number) {
  const [transactions, wallets] = await Promise.all([
    db.transactions.where("categoryId").equals(goal.categoryId).toArray(),
    db.accounts.toArray(),
  ]);
  return goalSaved(
    goal,
    transactions.filter((t) => t.id !== withoutId),
    new Map(wallets.map((w) => [w.id, w])),
  );
}
