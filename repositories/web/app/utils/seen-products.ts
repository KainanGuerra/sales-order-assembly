import type { ProductSearchItem } from '~/types/api';

// Products the seller has already seen for a client, kept on the phone so a
// search still finds them without signal. This is NOT the server's search
// (no typo tolerance, no ranking): it only looks for the typed text inside the
// name, or the exact EAN or SKU, and the screen says so.

const KEEP_PER_CLIENT = 300;
const SHOW_AT_MOST = 20;

const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// The newest sightings first; a product seen again moves to the front and
// replaces its older copy (so the price is the latest one seen). A discontinued
// product only ever appears for an exact code, so it is never worth keeping.
export function remember(seen: ProductSearchItem[], found: ProductSearchItem[]): ProductSearchItem[] {
  const fresh = found.filter((p) => p.availability !== 'INACTIVE');
  const freshIds = new Set(fresh.map((p) => p.id));
  return [...fresh, ...seen.filter((p) => !freshIds.has(p.id))].slice(0, KEEP_PER_CLIENT);
}

export function searchSeen(seen: ProductSearchItem[], text: string): ProductSearchItem[] {
  const q = plain(text);
  if (q.length < 2) {
    return [];
  }
  return seen
    .filter((p) => plain(p.description).includes(q) || p.ean === q || plain(p.sku) === q)
    .slice(0, SHOW_AT_MOST);
}
