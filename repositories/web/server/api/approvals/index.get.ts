import { backend } from '../../utils/backend';

// The orders waiting for the logged-in supervisor. The orders service answers
// 403 for anyone else.
export default defineEventHandler((event) => backend(event, 'orders', '/orders/pending-approval'));
