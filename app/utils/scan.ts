import type { CalendarDate } from "@internationalized/date";
import type { Worker } from "tesseract.js";
import { shallowRef } from "vue";

// Reading a bill photo or a bank-app screenshot on this device (Tesseract, Lao + English), then finding the
// payments in its text. BCEL One screenshots list several payments; a paper bill gives one, its total paid.

export interface ScannedPayment {
  type: "income" | "expense";
  // As printed, in major units (e.g. 72000.5)
  amount: number;
  // Currency code printed on it (e.g. "LAK"); missing when the image doesn't say
  currency?: string;
  // Missing when the image has no believable date
  date?: Date;
  // Merchant or payment name, e.g. "DELIVERY HERO (LAO)-2471004"
  note?: string;
  // Text the category suggestions read
  text: string;
}

// A scanned payment on the review screen, editable before it's saved
export interface ScanDraft {
  key: number;
  // Ticked to be saved
  include: boolean;
  type: "income" | "expense";
  accountId?: number;
  // Grouped as typed in AmountField, e.g. "87,000"
  amountText: string;
  categoryId?: number;
  day: CalendarDate;
  // Time of day it's saved at: the scan's, or now when the image has none
  time: Date;
  note: string;
  // The bill's currency, to warn when the wallet's differs (amounts aren't converted)
  billCurrency?: string;
  // A transaction with the same wallet, day, type and amount is already saved (e.g. an overlapping screenshot)
  maybeAdded: boolean;
  // Best category guesses, best first
  suggestions: number[];
}

// The image picked on the add screen, handed to the review screen
export const pendingScan = shallowRef<File>();

// One worker for the app; the first scan downloads the language files (a few MB), later ones reuse it.
// Its logger is set once, so progress goes through whichever scan is running.
let worker: Promise<Worker> | undefined;
let onProgress: ((progress: number) => void) | undefined;

function getWorker() {
  worker ??= import("tesseract.js").then(async ({ createWorker, PSM }) => {
    const w = await createWorker(["lao", "eng"], 1, {
      logger: (m) => m.status === "recognizing text" && onProgress?.(m.progress),
    });
    // Sauvola thresholding keeps the light grey lines on BCEL's cream cards that the default method drops
    await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, thresholding_method: "2" });
    return w;
  });
  // A failed start (e.g. offline on first use) can be retried
  worker.catch(() => (worker = undefined));
  return worker;
}

export async function readImage(image: Blob, progress?: (progress: number) => void) {
  const w = await getWorker();
  onProgress = progress;
  try {
    return (await w.recognize(image)).data.text;
  } finally {
    onProgress = undefined;
  }
}

// --- Finding payments in the text ---

// "72,000.00" → 72000; Lao digits (໐–໙) are read as 0–9 before this
const toNumber = (text: string) => Number.parseFloat(text.replaceAll(",", ""));
const laoDigits = (text: string) =>
  text.replace(/[໐-໙]/g, (d) => String(d.charCodeAt(0) - 0x0ed0));

// A grouped amount ("233,000", "9,184.50") or a plain one with decimals ("38000.00"); long digit runs
// without grouping are barcodes and phone numbers
const amountPattern = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}\b/g;

// DD/MM/YYYY with an optional time. Dates over a year old or in the future are misreads or other dates
// on the bill (e.g. a licence date), so they're skipped.
function findDate(text: string) {
  for (const m of text.matchAll(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g)) {
    // Without a time, midday, so the day can't shift
    const [d, mo, y, h = 12, mi = 0, s = 0] = m.slice(1).map((part) => (part === undefined ? undefined : Number(part)));
    const date = new Date(y!, mo! - 1, d, h, mi, s);
    const age = Date.now() - date.getTime();
    if (date.getDate() === d && date.getMonth() === mo! - 1 && age > -86_400_000 && age < 366 * 86_400_000) {
      return date;
    }
  }
  return undefined;
}

// Currency named on a bill, by code, symbol or Lao word. Bare "$" and "¥" aren't trusted: OCR turns ₭ and
// stray marks into them.
const currencyWords: [string, RegExp][] = [
  ["LAK", /\bLAK\b|\bKIP\b|₭|ກີບ/i],
  ["THB", /\bTHB\b|฿|ບາດ|\bbaht\b/i],
  ["USD", /\bUSD\b|US\$|ໂດລາ/i],
  ["VND", /\bVND\b|₫/i],
  ["CNY", /\bCNY\b|\bRMB\b|ຢວນ/i],
];
const findCurrency = (text: string) => currencyWords.find(([, pattern]) => pattern.test(text))?.[0];

// BCEL One "Messages": each payment starts with a line like "OnePay -87,000.00 LAK" or
// "Fund transfer received 38,000.00 LAK", followed by its details (Merchant / For / date)
function bcelPayments(lines: string[]): ScannedPayment[] {
  const starts = lines.flatMap((line, i) => {
    const m = line.match(/^(.*?)\s*(-?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*LAK\b/);
    return m ? [{ i, title: m[1]!, minus: m[2] === "-", amount: toNumber(m[3]!) }] : [];
  });
  return starts.map((start, n) => {
    const block = lines.slice(start.i + 1, starts[n + 1]?.i ?? lines.length).join("\n");
    // OCR puts stray marks before the title (the round badge), e.g. "S OnePay"
    const title = start.title.replace(/^(\S{1,2}\s+)+/, "").trim();
    const merchant = block.match(/Merchant:\s*(.+)/)?.[1]?.trim();
    const detail = block.match(/For:\s*(.+)/)?.[1]?.trim();
    const note = merchant ?? title;
    return {
      type: start.minus ? "expense" : "income",
      amount: start.amount,
      currency: "LAK",
      date: findDate(block),
      note: note.slice(0, 100) || undefined,
      text: [title, merchant, detail].filter(Boolean).join(" "),
    };
  });
}

// Paper bill: the amount on the "total paid" line, best label first. Thermal bills often print the
// amount on the next line, so that's read too. Without a label, the biggest amount.
// (OCR often drops Lao tone marks, so "ຈ່າຍ" can come out as "ຈາຍ")
const totalLabels = [/total\s*paid|paid\s*by|ຈ່?າຍ/i, /grand\s*total|ລວມທັງ/i, /total|ລວມ/i];

function billPayment(lines: string[], text: string): ScannedPayment | undefined {
  const lastAmount = (line = "") => line.match(amountPattern)?.at(-1);
  let amount: string | undefined;
  for (const label of totalLabels) {
    for (let i = 0; i < lines.length && !amount; i++) {
      if (label.test(lines[i]!)) amount = lastAmount(lines[i]) ?? lastAmount(lines[i + 1]);
    }
    if (amount) break;
  }
  amount ??= (text.match(amountPattern) ?? []).sort((a, b) => toNumber(b) - toNumber(a))[0];
  if (!amount || !(toNumber(amount) > 0)) return undefined;
  // Item names and the shop's name give the suggestions the most to go on; e5 reads ~500 tokens
  return {
    type: "expense",
    amount: toNumber(amount),
    currency: findCurrency(text),
    date: findDate(text),
    text: text.slice(0, 600),
  };
}

export function findPayments(rawText: string): ScannedPayment[] {
  const text = laoDigits(rawText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bank = bcelPayments(lines);
  if (bank.length) return bank;
  const bill = billPayment(lines, text);
  return bill ? [bill] : [];
}
