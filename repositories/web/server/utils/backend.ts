import { FetchError } from 'ofetch';
import { requireUser, type SessionUser } from './session';
import { mapUpstreamError } from './upstream-error';

type Service = 'identity' | 'catalog' | 'orders' | 'notifications';

const urls = (config: ReturnType<typeof useRuntimeConfig>): Record<Service, string> => ({
  identity: config.identityUrl,
  catalog: config.catalogUrl,
  orders: config.ordersUrl,
  notifications: config.notificationsUrl,
});

interface Options {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

// Calls a backend service as the logged-in user: the shared secret proves the
// call comes from this server, and the user headers say who is acting. The
// browser never sees either.
export async function backend<T>(event: Parameters<typeof requireUser>[0], service: Service, path: string, options: Options = {}): Promise<T> {
  const user = await requireUser(event);
  return backendAs<T>(user, service, path, options);
}

export async function backendAs<T>(user: SessionUser | null, service: Service, path: string, options: Options = {}): Promise<T> {
  const config = useRuntimeConfig();
  try {
    // The answer's shape is the caller's to state; Nitro's route typing cannot see a backend service.
    return (await $fetch<unknown>(path, {
      baseURL: urls(config)[service],
      method: options.method ?? 'GET',
      query: options.query,
      body: options.body as Record<string, unknown> | undefined,
      timeout: 8000,
      headers: {
        'x-inner-auth': config.innerAuth,
        ...(user ? { 'x-user-id': user.id, 'x-user-role': user.role } : {}),
      },
    })) as T;
  } catch (error) {
    if (error instanceof FetchError || error instanceof Error) {
      const failure = mapUpstreamError(error, service);
      throw createError({ statusCode: failure.statusCode, statusMessage: failure.message, data: failure.data });
    }
    throw error;
  }
}
