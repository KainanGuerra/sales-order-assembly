import { backendAs } from '../../utils/backend';

// Who can be picked on the login screen (no session yet).
export default defineEventHandler(() => backendAs(null, 'identity', '/login-options'));
