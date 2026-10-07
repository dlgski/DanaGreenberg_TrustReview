import { parseAmount } from './sourceMatch';

/** One input to a calculated field, as the analyst currently has it. */
export interface DerivedOperand {
  id: string;
  label: string;
  /** The model's value, or the analyst's correction if they edited it. */
  value: string;
  rejected: boolean;
}

export type Recalculation =
  | { kind: 'value'; value: string; changed: boolean }
  | { kind: 'blocked'; reason: string };

// Only "a <op> b" with two field ids. Anything else is reported, never evaluated.
const SIMPLE_FORMULA = /^\s*([A-Za-z_]\w*)\s*([+\-*/])\s*([A-Za-z_]\w*)\s*$/;

function decimalsIn(value: string): number {
  const match = /\.(\d+)\s*$/.exec(value.replace(/,/g, ''));
  return match ? match[1].length : 0;
}

/**
 * Recalculates a calculated field from the inputs the analyst has approved or
 * corrected, so the figure going into the memo matches the figures beside it.
 * The result keeps the model value's precision, so "changed" means a visible change.
 */
export function recalculate(
  formula: string,
  operands: DerivedOperand[],
  modelValue: string,
  /** Display names for inputs that haven't arrived yet, by field id. */
  labels: Record<string, string> = {},
): Recalculation {
  const match = SIMPLE_FORMULA.exec(formula);
  if (!match) return { kind: 'blocked', reason: "Can't recalculate this formula automatically. Check it by hand." };

  const [, leftId, operator, rightId] = match;
  const numbers: number[] = [];
  for (const id of [leftId, rightId]) {
    const operand = operands.find((o) => o.id === id);
    if (!operand) return { kind: 'blocked', reason: `Can't calculate: ${labels[id] ?? id} hasn't been extracted yet.` };
    if (operand.rejected) return { kind: 'blocked', reason: `Can't calculate: ${operand.label} was rejected.` };
    const number = parseAmount(operand.value);
    if (number === null) return { kind: 'blocked', reason: `Can't calculate: ${operand.label} isn't a number.` };
    numbers.push(number);
  }

  const [left, right] = numbers;
  if (operator === '/' && right === 0) {
    const divisor = operands.find((o) => o.id === rightId)!;
    return { kind: 'blocked', reason: `Can't calculate: ${divisor.label} is zero.` };
  }
  const result =
    operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right;

  const decimals = decimalsIn(modelValue);
  const format = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const value = format.format(result);
  const model = parseAmount(modelValue);
  return { kind: 'value', value, changed: model === null || value !== format.format(model) };
}
