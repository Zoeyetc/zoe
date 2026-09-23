const finite = (value: number) => Number.isFinite(value) ? value : 0;

export function compactUnit(value: number, digits = 2) {
  const valueText = Math.max(0, Math.min(1, finite(value))).toFixed(digits);
  return valueText.startsWith('0.') ? valueText.slice(1) : valueText;
}

export function compactNumber(value: number | null, digits = 2) {
  return value === null || !Number.isFinite(value) ? '—' : finite(value).toFixed(digits);
}

export function compactSigned(value: number, digits = 3) {
  const number = finite(value);
  const absolute = Math.abs(number).toFixed(digits).replace(/^0(?=\.)/, '');
  return `${number >= 0 ? '+' : '-'}${absolute}`;
}

export function compactAngle(radians: number) {
  const degrees = finite(radians) * 180 / Math.PI;
  return `${degrees >= 0 ? '+' : ''}${degrees.toFixed(1)}°`;
}

export const annotationPresentationHz = 10;
