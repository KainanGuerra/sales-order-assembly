// Presentation only. Business rules never live here: the backend decides what
// an order is worth and whether it can be sent. These helpers just turn the
// numbers it sends into text, and the text a person types into numbers.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Amounts arrive as integer cents.
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

// Discounts arrive as basis points: 500 is 5%.
export function formatBasisPoints(bp: number): string {
  return `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

// "5", "2,5" and "2.5" mean the same to the person typing. An empty box is
// no discount. Anything else is not a number: null, so the screen can say so.
export function parsePercentToBasisPoints(text: string): number | null {
  const normalised = text.trim().replace('%', '').replace(',', '.');
  if (normalised === '') {
    return 0;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) {
    return null;
  }
  return Math.round(Number(normalised) * 100);
}

// "24/10/2026 12:05", in the viewer's time zone unless one is given.
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(iso));
}

// "user:S01" is the person S01; "system:orders" is the system.
export function parseActor(actor: string): { kind: 'user' | 'system'; name: string } {
  const [kind, ...rest] = actor.split(':');
  return { kind: kind === 'user' ? 'user' : 'system', name: rest.join(':') };
}

export function basisPointsToInput(bp: number): string {
  return bp === 0 ? '' : String(bp / 100).replace('.', ',');
}
