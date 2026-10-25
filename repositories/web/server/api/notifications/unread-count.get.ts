import { backend } from '../../utils/backend';

export default defineEventHandler((event) => backend(event, 'notifications', '/notifications/unread-count'));
