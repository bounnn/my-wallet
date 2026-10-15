// Amounts are stored in minor units; the number of digits depends on the currency (USD 2, JPY 0, ...)
export function currencyDigits(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function toMinor(amount: number, currency: string) {
  return Math.round(amount * 10 ** currencyDigits(currency));
}

export function fromMinor(minor: number, currency: string) {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    fromMinor(minor, currency),
  );
}

// Number only, no currency sign, with the currency's decimals (e.g. "1,250.50"), for when the currency is shown apart
export function formatAmount(minor: number, currency: string) {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    fromMinor(minor, currency),
  );
}

// Formatted pieces, so the cents can be styled lighter than the whole amount (e.g. $87,457.85)
export function formatMoneyParts(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency })
    .formatToParts(fromMinor(minor, currency))
    .map((part) => ({ value: part.value, isFraction: part.type === "decimal" || part.type === "fraction" }));
}

// Amount typed in a text field, regrouped as you type ("1250.5" → "1,250.5"); drops anything that isn't
// a digit or the first ".", and extra decimals for the currency
export function groupAmountInput(text: string, currency: string) {
  const [whole = "", ...rest] = text.replace(/[^\d.]/g, "").split(".");
  const digits = currencyDigits(currency);
  const fraction = rest.length && digits ? rest.join("").slice(0, digits) : undefined;
  if (!whole && fraction === undefined) return "";
  return formatAmountInput(fraction === undefined ? whole : `${whole || "0"}.${fraction}`);
}

// Typed amount text ("1,250.50") → minor units; commas are grouping. NaN when it isn't a number.
export function parseAmount(text: string, currency: string) {
  const clean = text.replaceAll(",", "").trim();
  if (!/^\d*\.?\d*$/.test(clean) || !/\d/.test(clean)) return Number.NaN;
  return toMinor(Number.parseFloat(clean), currency);
}

export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

// Keypad text shown as typed (keeps a trailing "." or "0") with grouping, e.g. "1250.5" → "1,250.5"
export function formatAmountInput(text: string) {
  if (!text) return "0";
  const [whole = "0", fraction] = text.split(".");
  const grouped = new Intl.NumberFormat(undefined).format(Number(whole));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

// Currency of the phone's region (from its language setting, e.g. lo-LA → LAK), USD when unknown.
// Browsers don't expose region → currency, so this covers the common regions; the rest pick from the list.
const regionCurrencies: Record<string, string> = {
  LA: "LAK", TH: "THB", VN: "VND", KH: "KHR", MM: "MMK", MY: "MYR", SG: "SGD", ID: "IDR", PH: "PHP",
  CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY", KR: "KRW", IN: "INR", AU: "AUD", NZ: "NZD",
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", TR: "TRY", RU: "RUB", ZA: "ZAR", AE: "AED", SA: "SAR",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR",
  FI: "EUR", GR: "EUR",
};
export function localCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return (region && regionCurrencies[region]) || "USD";
  } catch {
    return "USD";
  }
}

export function currencyOptions() {
  const names = new Intl.DisplayNames(undefined, { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => ({
    code,
    name: names.of(code) ?? code,
    symbol: currencySymbol(code),
  }));
}
