import { ValueTransformer } from 'typeorm';

/**
 * Transformer untuk kolom numeric Postgres.
 * - Saat baca dari DB (string) → number
 * - Saat tulis ke DB (number)  → string (fixed precision)
 */
export class NumericTransformer implements ValueTransformer {
  constructor(private readonly scale: number = 2) {}

  to(value: number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return Number(value).toFixed(this.scale);
  }

  from(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return parseFloat(value);
  }
}