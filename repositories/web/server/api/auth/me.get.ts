import { requireUser } from '../../utils/session';

export default defineEventHandler((event) => requireUser(event));
