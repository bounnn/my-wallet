import { type Category, db, type Goal, type Transaction } from "./db";
import { UserError } from "./error";
import { formatMoney } from "./money";

// Saved toward a goal: its starting amount, plus money added (expenses in its category) minus money taken out
// (incomes), from the goal's wallet
export function goalSaved(goal: Goal, transactions: Transaction[]) {
  let saved = goal.initialSaved;
  for (const t of transactions) {
    if (t.categoryId !== goal.categoryId || t.accountId !== goal.accountId) continue;
    saved += t.type === "expense" ? t.amount : -t.amount;
  }
  return saved;
}

// Same, read from the database for a check before saving or deleting one of the goal's transactions,
// which is left out (`withoutId`)
export async function loadGoalSaved(goal: Goal, withoutId?: number) {
  const transactions = await db.transactions.where("categoryId").equals(goal.categoryId).toArray();
  return goalSaved(
    goal,
    transactions.filter((t) => t.id !== withoutId),
  );
}

export type GoalStatus = { tone: "success" | "warning" | "error" | "info"; icon: string; text: string };

const DAY = 24 * 60 * 60 * 1000;

// How a goal is doing with `saved`: share of the target, what's left, how far behind an even pace to its due
// date it is (0 when on track or without one), and a status line for the card
export function goalProgress(goal: Goal, saved: number, now = new Date()) {
  const progress = goal.target ? Math.min(Math.max(saved / goal.target, 0), 1) : 0;
  const left = Math.max(goal.target - saved, 0);
  // Where saving should be by now if it went evenly from the start to the due date
  const expected = goal.deadline
    ? Math.min(
        Math.max((now.getTime() - goal.createdAt.getTime()) / (goal.deadline.getTime() - goal.createdAt.getTime()), 0),
        1,
      )
    : 0;
  const behind = left > 0 && expected - progress > 0.05 ? expected - progress : 0;
  return { progress, left, behind, status: goalStatus(goal, left, behind, now) };
}

function goalStatus(goal: Goal, left: number, behind: number, now: Date): GoalStatus | undefined {
  if (!left) return { tone: "success", icon: "i-lucide-party-popper", text: "Goal reached, well done" };
  if (!goal.deadline) return undefined;
  const days = Math.ceil((goal.deadline.getTime() - now.getTime()) / DAY);
  if (days < 0) {
    return { tone: "error", icon: "i-lucide-circle-alert", text: `Due date passed, ${formatMoney(left, goal.currency)} to go` };
  }
  if (behind) {
    return { tone: "warning", icon: "i-lucide-clock-alert", text: `A little behind, ${Math.round(behind * 100)}% to catch up` };
  }
  // On track: what's still needed per month (or the whole rest when it's due within a month)
  const months = Math.floor(days / 30);
  return months >= 1
    ? { tone: "info", icon: "i-lucide-calendar-check", text: `On track, save ${formatMoney(Math.ceil(left / months), goal.currency)} a month` }
    : { tone: "info", icon: "i-lucide-calendar-check", text: `On track, due in ${days} ${days === 1 ? "day" : "days"}` };
}

export const goalByCategory =(categoryId: number) => db.goals.where("categoryId").equals(categoryId).first();

// Name, icon and color live on the goal's own expense category
export type GoalCategoryFields = Pick<Category, "name" | "icon" | "color">;
export type GoalFields = Pick<Goal, "target" | "deadline">;

export function addGoal(accountId: number, category: GoalCategoryFields, fields: GoalFields) {
  return db.transaction("rw", [db.accounts, db.goals, db.categories], async () => {
    const wallet = await db.accounts.get(accountId);
    if (!wallet) throw new UserError("Add a wallet first");
    const categoryId = await db.categories.add({ ...category, type: "expense" });
    return db.goals.add({
      ...fields,
      accountId,
      categoryId,
      currency: wallet.currency,
      initialSaved: 0,
      createdAt: new Date(),
    });
  });
}

export function updateGoal(goal: Goal, category: GoalCategoryFields, fields: GoalFields) {
  return db.transaction("rw", db.goals, db.categories, async () => {
    await db.categories.update(goal.categoryId, category);
    await db.goals.update(goal.id, fields);
  });
}

// The goal's category is archived, not deleted, so its transactions keep their name; restoreGoal brings both back
export function deleteGoal(goal: Goal) {
  return db.transaction("rw", db.goals, db.categories, async () => {
    await db.goals.delete(goal.id);
    await db.categories.update(goal.categoryId, { archived: true });
  });
}

export function restoreGoal(goal: Goal) {
  return db.transaction("rw", db.goals, db.categories, async () => {
    await db.goals.add(goal);
    await db.categories.update(goal.categoryId, { archived: false });
  });
}
