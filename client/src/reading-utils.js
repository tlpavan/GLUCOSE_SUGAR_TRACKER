export const SLOTS = [
  ['morning_fasting', 'Morning (fasting)'],
  ['after_breakfast', 'After breakfast'],
  ['after_lunch', 'After lunch'],
  ['after_dinner', 'After dinner'],
];
export const slotLabel = (slot) => SLOTS.find(([id]) => id === slot)?.[1] || slot;
export function localToday(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1
    && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function dateError(value, today = localToday()) {
  if (!validDate(value)) return 'Choose a real date.';
  return value > today ? 'Future dates are not allowed.' : '';
}
export function readingErrors(values, today = localToday()) {
  const errors = {};
  const error = dateError(values.date, today);
  if (error) errors.date = error;
  if (!SLOTS.some(([id]) => id === values.slot)) errors.slot = 'Choose one of the four reading slots.';
  if (!String(values.valueMgDl).trim()) errors.valueMgDl = 'Enter a glucose value.';
  else if (!/^\d+$/.test(String(values.valueMgDl)) || !Number.isInteger(Number(values.valueMgDl)) || Number(values.valueMgDl) < 40 || Number(values.valueMgDl) > 600) {
    errors.valueMgDl = 'Enter a whole number from 40 to 600 mg/dL.';
  }
  return errors;
}
