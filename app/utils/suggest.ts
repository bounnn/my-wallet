import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { db, type Category, type Transaction } from "./db";

// Category suggestions from a small multilingual model (multilingual-e5-small, reads Lao and English) that runs
// on this device. A scanned payment is compared with the notes of past transactions, so the same or a similar
// merchant gets the category it had before, and with each category's name (plus a few example words for
// the starter categories) for merchants never seen. Roughly right, not always; the pick can be changed.

const modelId = "Xenova/multilingual-e5-small";

// Example words for the starter categories; categories made or renamed by the user go by their name only
const hints: Record<string, string> = {
  "Food & drink": "restaurant, cafe, coffee, tea, meal, food delivery, foodpanda, ຮ້ານອາຫານ, ອາຫານ, ກາເຟ, ເຄື່ອງດື່ມ",
  Groceries: "supermarket, mart, minimart, market, eggs, noodles, drinking water, ຕະຫຼາດ, ມາດ, ຮ້ານຄ້າ, ນ້ຳດື່ມ, ໄຂ່",
  Transport: "fuel, petrol, taxi, bus, parking, ນ້ຳມັນ, ລົດ, ແທັກຊີ",
  Shopping: "clothes, shoes, electronics, online shop, ເສື້ອຜ້າ, ເກີບ",
  Bills: "water bill, electricity, internet, phone top-up, utilities, ຄ່ານ້ຳ, ຄ່າໄຟ, ອິນເຕີເນັດ",
  Home: "cleaning products, detergent, household supplies, furniture, rent, ນ້ຳຢາລ້າງ, ເຄື່ອງໃຊ້ໃນເຮືອນ",
  Health: "pharmacy, medicine, hospital, clinic, doctor, ຮ້ານຂາຍຢາ, ໂຮງໝໍ, ຄລີນິກ",
  Fun: "movies, games, karaoke, travel, hobbies, ຮູບເງົາ, ເກມ",
  Salary: "salary, wage, payroll, ເງິນເດືອນ",
  Gift: "gift, ຂອງຂວັນ",
};

// Past notes compared, newest first; enough to cover regular merchants without slowing the first suggestion
const maxNotes = 300;

// Loaded on first use: ~120 MB from Hugging Face (too big for GitHub Pages), then kept in the browser's cache
let model: Promise<FeatureExtractionPipeline> | undefined;
let onDownload: ((progress: number) => void) | undefined;

function getModel() {
  model ??= import("@huggingface/transformers").then(({ env, pipeline }) => {
    // Only the Hugging Face copy exists; skips asking this site for /models/ first
    env.allowLocalModels = false;
    return pipeline("feature-extraction", modelId, {
      dtype: "q8",
      progress_callback: (p) => {
        if (p.status === "progress" && p.file.endsWith(".onnx")) onDownload?.(p.progress / 100);
      },
    });
  });
  // A failed download (e.g. offline on first use) can be retried
  model.catch(() => (model = undefined));
  return model;
}

// Vectors are kept for the session, so later suggestions only read the new text
const vectors = new Map<string, number[]>();

async function embed(texts: string[]) {
  const missing = [...new Set(texts.filter((t) => !vectors.has(t)))];
  if (missing.length) {
    const extract = await getModel();
    // e5 expects this prefix; the same one on both sides compares like with like
    const output = await extract(missing.map((t) => `query: ${t}`), { pooling: "mean", normalize: true });
    (output.tolist() as number[][]).forEach((v, i) => vectors.set(missing[i]!, v));
  }
  return texts.map((t) => vectors.get(t)!);
}

// Both vectors are normalized, so the dot product is the cosine similarity
const similarity = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);

// The given categories' ids, best match first. `download` reports the model download on first use (0–1).
export async function suggestCategories(
  text: string,
  categories: Category[],
  download?: (progress: number) => void,
): Promise<number[]> {
  if (!categories.length) return [];
  const ids = new Set(categories.map((c) => c.id));

  // The latest category per note, for these categories only
  const history = new Map<string, number>();
  await db.transactions
    .orderBy("date")
    .reverse()
    .until(() => history.size >= maxNotes)
    .each((t: Transaction) => {
      const note = t.note?.trim();
      if (note && ids.has(t.categoryId) && !history.has(note)) history.set(note, t.categoryId);
    });

  const labels = categories.map((c) => (hints[c.name] ? `${c.name}: ${hints[c.name]}` : c.name));
  const notes = [...history.keys()];
  onDownload = download;
  let vecs: number[][];
  try {
    vecs = await embed([text, ...labels, ...notes]);
  } finally {
    onDownload = undefined;
  }
  const [query, ...rest] = vecs;

  // A category's score is its best match: its own label or any note filed under it
  const scores = new Map<number, number>();
  const keep = (id: number, score: number) => scores.set(id, Math.max(scores.get(id) ?? -1, score));
  categories.forEach((c, i) => keep(c.id, similarity(query!, rest[i]!)));
  notes.forEach((note, i) => keep(history.get(note)!, similarity(query!, rest[labels.length + i]!)));
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
