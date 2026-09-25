/**
 * All monetary values cross the API as integer INR paise. These helpers keep
 * the conversion to a plain rupee string in one place so no component can
 * accidentally format a paise value as rupees or introduce float maths.
 */

/** Formats integer paise as an INR amount, e.g. 15000 -> "₹150.00", 100 -> "₹1". */
export function formatInr(paise: number): string {
  if (!Number.isFinite(paise)) return '₹0';
  const negative = paise < 0;
  const absolute = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const grouped = rupees.toLocaleString('en-IN');
  // Whole rupee amounts stay clean; only show paise when it is actually owed.
  const body = remainder === 0 ? grouped : `${grouped}.${String(remainder).padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${body}`;
}

/** Converts a rupee input (e.g. 150 or 150.5) to integer paise for the API. */
export function rupeesToPaise(rupees: number): number | null {
  if (!Number.isFinite(rupees)) return null;
  const paise = Math.round(rupees * 100);
  return paise > 0 ? paise : null;
}
