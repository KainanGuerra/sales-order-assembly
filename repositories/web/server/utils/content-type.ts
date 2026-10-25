// The API speaks JSON only. A browser can send a form (a cross-site <form>
// POST) without asking permission, but it cannot send JSON that way, so
// refusing anything else closes that door on top of SameSite=Lax.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isAllowedRequest(method: string, headers: Record<string, string | string[] | undefined>): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }
  const length = Number(headers['content-length'] ?? 0);
  const hasBody = length > 0 || headers['transfer-encoding'] !== undefined;
  if (!hasBody) {
    return true;
  }
  const type = headers['content-type'];
  return typeof type === 'string' && type.toLowerCase().startsWith('application/json');
}
