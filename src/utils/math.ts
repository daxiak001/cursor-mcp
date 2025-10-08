export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new Error('min must be <= max');
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function average(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let sum = 0;
  for (const v of values) {
    const n = typeof v === 'number' && isFinite(v) ? v : 0;
    sum += n;
  }
  return sum / values.length;
}



