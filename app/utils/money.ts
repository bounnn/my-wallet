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

// Formatted pieces, so the cents can be styled lighter than the whole amount (e.g. $87,457.85)
export function formatMoneyParts(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency })
    .formatToParts(fromMinor(minor, currency))
    .map((part) => ({ value: part.value, isFraction: part.type === "decimal" || part.type === "fraction" }));
}

export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

export function currencyOptions() {
  const names = new Intl.DisplayNames(undefined, { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => ({
    code,
    name: names.of(code) ?? code,
    symbol: currencySymbol(code),
  }));
}
