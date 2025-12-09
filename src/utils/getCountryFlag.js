// src/utils/getCountryFlag.js
export function getCountryFlag(countryCode) {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();

  if (code === 'NO') return '🇳🇴';
  if (code === 'SE') return '🇸🇪';

  // Fallback : rien si autre chose
  return '';
}
