import { describe, expect, it } from 'vitest';
import { recalculate, type DerivedOperand } from './derived';

const ebitda = (value = '6,120', rejected = false): DerivedOperand => ({ id: 'ebitda', label: 'EBITDA', value, rejected });
const debtService = (value = '4,310', rejected = false): DerivedOperand => ({
  id: 'annual_debt_service',
  label: 'Annual debt service',
  value,
  rejected,
});
const FORMULA = 'ebitda / annual_debt_service';

describe('recalculate', () => {
  it('matches the model when the inputs are unchanged', () => {
    expect(recalculate(FORMULA, [ebitda(), debtService()], '1.42')).toEqual({ kind: 'value', value: '1.42', changed: false });
  });

  it('recalculates from an edited input, keeping the model value precision', () => {
    expect(recalculate(FORMULA, [ebitda('5,914'), debtService()], '1.42')).toEqual({
      kind: 'value',
      value: '1.37',
      changed: true,
    });
  });

  it('supports the other simple operators', () => {
    expect(recalculate('a + b', [{ id: 'a', label: 'A', value: '1,000', rejected: false }, { id: 'b', label: 'B', value: '250', rejected: false }], '1,250')).toEqual({
      kind: 'value',
      value: '1,250',
      changed: false,
    });
    expect(recalculate('a - b', [{ id: 'a', label: 'A', value: '10', rejected: false }, { id: 'b', label: 'B', value: '4', rejected: false }], '5')).toMatchObject({
      value: '6',
      changed: true,
    });
    expect(recalculate('a * b', [{ id: 'a', label: 'A', value: '1.5', rejected: false }, { id: 'b', label: 'B', value: '2', rejected: false }], '3.0')).toMatchObject({
      value: '3.0',
      changed: false,
    });
  });

  it('is blocked when an input was rejected', () => {
    expect(recalculate(FORMULA, [ebitda(), debtService('4,310', true)], '1.42')).toEqual({
      kind: 'blocked',
      reason: "Can't calculate: Annual debt service was rejected.",
    });
  });

  it('is blocked when an input has not arrived yet', () => {
    expect(recalculate(FORMULA, [ebitda()], '1.42', { annual_debt_service: 'Annual debt service' })).toEqual({
      kind: 'blocked',
      reason: "Can't calculate: Annual debt service hasn't been extracted yet.",
    });
  });

  it('is blocked when an input is not a number', () => {
    expect(recalculate(FORMULA, [ebitda('n/a'), debtService()], '1.42')).toEqual({
      kind: 'blocked',
      reason: "Can't calculate: EBITDA isn't a number.",
    });
  });

  it('is blocked when dividing by zero', () => {
    expect(recalculate(FORMULA, [ebitda(), debtService('0')], '1.42')).toEqual({
      kind: 'blocked',
      reason: "Can't calculate: Annual debt service is zero.",
    });
  });

  it('is blocked for a formula it cannot read safely', () => {
    expect(recalculate('(ebitda - capex) / annual_debt_service', [ebitda(), debtService()], '1.42')).toEqual({
      kind: 'blocked',
      reason: "Can't recalculate this formula automatically. Check it by hand.",
    });
  });
});
