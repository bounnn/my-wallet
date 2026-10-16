import { db, type Transaction, type Transfer } from "./db";
import { UserError } from "./error";
import { fromMinor, toMinor } from "./money";

// What the add screen sends: the received amount is worked out here from the wallets' currencies and the rate
export type TransferFields = Omit<Transfer, "id" | "createdAt" | "toAmount">;

// Home lists transfers among transactions; this tells them apart
export const isTransfer = (item: Transaction | Transfer): item is Transfer => "toAccountId" in item;

// What a transfer does to one wallet's balance: out of the sending one, into the receiving one
export function transferChange(transfer: Transfer, accountId: number | undefined) {
  if (transfer.fromAccountId === accountId) return -transfer.amount;
  if (transfer.toAccountId === accountId) return transfer.toAmount;
  return 0;
}

// Sent amount (minor units of `from`) at `rate` → received amount (minor units of `to`)
export function convertAmount(amount: number, rate: number, from: string, to: string) {
  return toMinor(fromMinor(amount, from) * rate, to);
}

// Exchange rates are typed with up to this many decimals
export const rateDigits = 6;

// "1 USD = 21,500 LAK", turned round when that reads better than "1 LAK = 0.000047 USD"
export function formatRate(rate: number, from: string, to: string) {
  const [base, quote, value] = rate >= 1 ? [from, to, rate] : [to, from, 1 / rate];
  return `1 ${base} = ${new Intl.NumberFormat(undefined, { maximumFractionDigits: rateDigits }).format(value)} ${quote}`;
}

// The rate used last between two currencies (either way round), to start the next transfer with
export async function lastRate(from: string, to: string) {
  const currencyOf = new Map((await db.accounts.toArray()).map((w) => [w.id, w.currency]));
  const transfers = await db.transfers.orderBy("date").reverse().toArray();
  for (const t of transfers) {
    if (!t.rate) continue;
    const sent = currencyOf.get(t.fromAccountId);
    const received = currencyOf.get(t.toAccountId);
    if (sent === from && received === to) return t.rate;
    if (sent === to && received === from) return 1 / t.rate;
  }
}

// Adds a transfer, or updates `id` with the new fields
export function saveTransfer(fields: TransferFields, id?: number) {
  return db.transaction("rw", db.accounts, db.transfers, async () => {
    if (fields.fromAccountId === fields.toAccountId) throw new UserError("Pick two different wallets");
    const [from, to] = await Promise.all([db.accounts.get(fields.fromAccountId), db.accounts.get(fields.toAccountId)]);
    if (!from || !to) throw new UserError("One of the wallets was deleted");
    const sameCurrency = from.currency === to.currency;
    if (!sameCurrency && !(fields.rate && fields.rate > 0)) throw new UserError("Enter the exchange rate");
    const transfer = {
      ...fields,
      rate: sameCurrency ? undefined : fields.rate,
      toAmount: sameCurrency ? fields.amount : convertAmount(fields.amount, fields.rate!, from.currency, to.currency),
    };
    if (id === undefined) await db.transfers.add({ ...transfer, createdAt: new Date() });
    // put, not update, so a rate dropped by switching to same-currency wallets is removed
    else {
      const old = await db.transfers.get(id);
      if (!old) throw new UserError("This transfer was deleted");
      await db.transfers.put({ ...transfer, id, createdAt: old.createdAt });
    }
  });
}

// restoreTransfer puts it back (undo)
export function deleteTransfer(transfer: Transfer) {
  return db.transfers.delete(transfer.id);
}

export function restoreTransfer(transfer: Transfer) {
  return db.transfers.add(transfer);
}
