import { isAllowedRequest } from '../utils/content-type';

export default defineEventHandler((event) => {
  if (!getRequestURL(event).pathname.startsWith('/api/')) {
    return;
  }
  if (!isAllowedRequest(event.method, getRequestHeaders(event))) {
    throw createError({ statusCode: 415, statusMessage: 'Unsupported Media Type' });
  }
});
