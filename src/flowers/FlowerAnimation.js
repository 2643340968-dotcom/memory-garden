export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function easeOutBloom(value, overshoot = 1.06) {
  const t = clamp01(value);

  if (t < 0.72) {
    const rise = t / 0.72;
    return overshoot * (1 - Math.pow(1 - rise, 3));
  }

  const settle = (t - 0.72) / 0.28;
  const smoothSettle = settle * settle * (3 - 2 * settle);
  return overshoot + (1 - overshoot) * smoothSettle;
}
