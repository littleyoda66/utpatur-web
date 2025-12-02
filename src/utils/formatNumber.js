// src/utils/formatNumber.js
export function formatNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return '—';

  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  const fixed = rounded.toFixed(decimals);

  const [intPart, decPart] = fixed.split('.');

  // Séparateur des milliers = apostrophe '
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  // Séparateur décimal = point .
  if (!decPart || Number(decPart) === 0) {
    return intWithSep;
  }

  return `${intWithSep}.${decPart}`;
}
