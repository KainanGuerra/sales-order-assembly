// Who is acting, as forwarded by the BFF after it validated the session.
export type Role = 'SELLER' | 'SUPERVISOR';

export interface Actor {
  role: Role;
  id: string;
}

export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';

export function parseActor(headers: Record<string, string | string[] | undefined>): Actor | null {
  const id = headers[USER_ID_HEADER];
  const role = headers[USER_ROLE_HEADER];
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  if (role !== 'SELLER' && role !== 'SUPERVISOR') {
    return null;
  }
  return { role, id };
}
