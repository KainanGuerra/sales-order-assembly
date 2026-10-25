import { requireUser } from '../../utils/session';

// Passes the notifications service's event stream on to the browser. The
// service only says "something changed" (the screen then asks for the list), so
// nothing sensitive travels here, but the call still carries the inner secret
// and the user, which the browser must never hold.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();

  // When the browser leaves, the connection to the service is closed too.
  const upstreamAbort = new AbortController();
  event.node.req.on('close', () => upstreamAbort.abort());

  let upstream: Response;
  try {
    upstream = await fetch(`${config.notificationsUrl}/notifications/stream`, {
      headers: { 'x-inner-auth': config.innerAuth, 'x-user-id': user.id, 'x-user-role': user.role, accept: 'text/event-stream' },
      signal: upstreamAbort.signal,
    });
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'notifications is unavailable, try again shortly' });
  }
  if (!upstream.ok || !upstream.body) {
    throw createError({ statusCode: 503, statusMessage: 'notifications is unavailable, try again shortly' });
  }

  setResponseHeaders(event, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    // Tells proxies in front (nginx, ingress) not to hold the stream back.
    'x-accel-buffering': 'no',
  });
  return sendStream(event, upstream.body);
});
