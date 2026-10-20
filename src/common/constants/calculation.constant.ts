export const TAX_CHANGE_DATE = '2022-04-01';

export function getDivisor(dateStr: string): number {
  return dateStr >= TAX_CHANGE_DATE ? 1.11 : 1.10;
}

export function getTaxRate(dateStr: string): number {
  return dateStr >= TAX_CHANGE_DATE ? 11 : 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}