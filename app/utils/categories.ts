import { type Category, db } from "./db";

export type CategoryFields = Pick<Category, "name" | "icon" | "color">;

export function addCategory(type: Category["type"], fields: CategoryFields) {
  return db.categories.add({ ...fields, type });
}

export function updateCategory(id: number, fields: CategoryFields) {
  return db.categories.update(id, fields);
}

// A category with transactions or budgets is archived so they keep its name; an unused one is deleted.
// Returns whether it was archived, which restoreCategory needs to undo it.
export function deleteCategory(category: Category) {
  return db.transaction("rw", db.categories, db.transactions, db.budgets, async () => {
    const used =
      (await db.transactions.where("categoryId").equals(category.id).count()) > 0 ||
      (await db.budgets.where("categoryIds").equals(category.id).count()) > 0;
    if (used) await db.categories.update(category.id, { archived: true });
    else await db.categories.delete(category.id);
    return used;
  });
}

export async function restoreCategory(category: Category, archived: boolean) {
  if (archived) await db.categories.update(category.id, { archived: false });
  else await db.categories.add(category);
}
