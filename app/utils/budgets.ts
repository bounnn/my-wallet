import { type Budget, db } from "./db";
import { UserError } from "./error";

export type BudgetFields = Pick<Budget, "name" | "categoryIds" | "amount">;

// A category is in at most one of a wallet's budgets a month; `id` is the budget being edited
async function checkFree(accountId: number, month: string, categoryIds: number[], id?: number) {
  const others = await db.budgets.where("month").equals(month).toArray();
  const taken = new Set(others.filter((b) => b.accountId === accountId && b.id !== id).flatMap((b) => b.categoryIds));
  if (categoryIds.some((c) => taken.has(c))) throw new UserError("A category here already has a budget this month");
}

export function addBudget(accountId: number, month: string, fields: BudgetFields) {
  return db.transaction("rw", db.budgets, async () => {
    await checkFree(accountId, month, fields.categoryIds);
    return db.budgets.add({ ...fields, accountId, month, createdAt: new Date() });
  });
}

export function updateBudget(budget: Budget, fields: BudgetFields) {
  return db.transaction("rw", db.budgets, async () => {
    await checkFree(budget.accountId, budget.month, fields.categoryIds, budget.id);
    await db.budgets.update(budget.id, fields);
  });
}

// Copies of earlier budgets into `month`
export function copyBudgets(accountId: number, month: string, budgets: BudgetFields[]) {
  return db.transaction("rw", db.budgets, async () => {
    await checkFree(accountId, month, budgets.flatMap((b) => b.categoryIds));
    const now = new Date();
    await db.budgets.bulkAdd(budgets.map((b) => ({ ...b, accountId, month, createdAt: now })));
  });
}

// restoreBudget puts it back (undo)
export function deleteBudget(budget: Budget) {
  return db.budgets.delete(budget.id);
}

export function restoreBudget(budget: Budget) {
  return db.budgets.add(budget);
}
