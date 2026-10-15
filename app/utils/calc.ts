// Calculator expressions typed on AmountKeypad, e.g. "12.5+3×2" (display symbols, no eval)
export const operators = ["+", "-", "×", "÷"] as const;
export type Operator = (typeof operators)[number];

export const isOperator = (s: string | undefined): s is Operator => operators.includes(s as Operator);
export const hasOperator = (expr: string) => /[+\-×÷]/.test(expr);

const tokens = (expr: string) => expr.split(/([+\-×÷])/).filter((p) => p !== "");

// × and ÷ before + and -; a trailing operator is ignored. Returns NaN/Infinity for e.g. division by zero.
export function evaluateExpression(expr: string) {
  const parts = tokens(expr);
  if (isOperator(parts.at(-1))) parts.pop();
  if (!parts.length) return 0;

  let total = 0;
  let sign = 1;
  let term = Number.parseFloat(parts[0]!);
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i];
    const n = Number.parseFloat(parts[i + 1]!);
    if (op === "×") term *= n;
    else if (op === "÷") term /= n;
    else {
      total += sign * term;
      sign = op === "+" ? 1 : -1;
      term = n;
    }
  }
  return total + sign * term;
}

// "1250+30×2" → "1,250 + 30 × 2"
export function formatExpression(expr: string) {
  return tokens(expr)
    .map((p) => (isOperator(p) ? ` ${p} ` : formatAmountInput(p)))
    .join("");
}
