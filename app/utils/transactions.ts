import { db, type Transaction, type TransactionDay, type Transfer } from "./db";
import { weekdayLabel } from "./date";
import { UserError } from "./error";
import { goalByCategory, loadGoalSaved } from "./goals";
import { formatMoney } from "./money";

export type TransactionFields = Omit<Transaction, "id" | "createdAt">;

// A goal's saved amount can't go below 0: money taken out can't exceed what's saved, and money added
// can't be lowered or removed once some of it was taken out again. `fields` is the transaction after the
// change (undefined when deleting it), `id` the one being changed.
async function checkGoal(categoryId: number, id: number | undefined, fields: TransactionFields | undefined) {
  const goal = await goalByCategory(categoryId);
  if (!goal) return;
  const others = await loadGoalSaved(goal, id);
  // Only the goal's wallet counts toward it
  const signed = fields?.type === "expense" ? fields.amount : -(fields?.amount ?? 0);
  const change = fields?.accountId === goal.accountId ? signed : 0;
  if (others + change >= 0) return;
  if (!fields) throw new UserError(`${formatMoney(-others, goal.currency)} of it was already taken out of the goal`);
  throw new UserError(
    fields.type === "income"
      ? `Only ${formatMoney(Math.max(others, 0), goal.currency)} saved`
      : `At least ${formatMoney(-others, goal.currency)}, it was taken out since`,
  );
}

// Adds a transaction, or updates `id` with the new fields
export function saveTransaction(fields: TransactionFields, id?: number) {
  return db.transaction("rw", db.transactions, db.goals, async () => {
    await checkGoal(fields.categoryId, id, fields);
    if (id === undefined) await db.transactions.add({ ...fields, createdAt: new Date() });
    else await db.transactions.update(id, fields);
  });
}

// restoreTransaction puts it back (undo)
export function deleteTransaction(transaction: Transaction) {
  return db.transaction("rw", db.transactions, db.goals, async () => {
    await checkGoal(transaction.categoryId, transaction.id, undefined);
    await db.transactions.delete(transaction.id);
  });
}

export function restoreTransaction(transaction: Transaction) {
  return db.transactions.add(transaction);
}

// Splits newest-first items into days ("Today", "Yesterday", "Wed 14/10"), each with its net total.
// `change` is what an item does to the shown wallet's balance.
export function groupByDay(list: (Transaction | Transfer)[], change: (item: Transaction | Transfer) => number) {
  const days: TransactionDay[] = [];
  for (const t of list) {
    const key = t.date.toDateString();
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, date: t.date, label: weekdayLabel(t.date), total: 0, items: [] };
      days.push(day);
    }
    day.total += change(t);
    day.items.push(t);
  }
  return days;
}
