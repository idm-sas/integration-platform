export const ALLOWED_ORGTRX_IDS = [
  1000006,
  1000008,
  2200020,
  1000010,
  2200021,
  2200022,
  2200037,
  2200038,
  2200034,
  2200035,
  2200036,
  2200033,
];
export const ALLOWED_DOCTYPE_IDS = [
  1000002,
  1000003,
  1000042,
  1000043
];
export const FULL_SYNC_DATE_FROM = '2026-09-01';
export const FULL_SYNC_DATE_TO   = '2026-09-20';
export const BATCH_IN_SIZE = 1000;
export const BATCH_SAVE    = 200;

// ─── Konstanta Perhitungan Pajak ─────────────────────────────────────────────
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