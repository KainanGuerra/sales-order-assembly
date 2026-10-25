import { describe, expect, it } from 'vitest';
import { isAllowedRequest } from '../server/utils/content-type';

describe('isAllowedRequest', () => {
  it('lets reads through', () => {
    expect(isAllowedRequest('GET', {})).toBe(true);
    expect(isAllowedRequest('HEAD', {})).toBe(true);
  });

  it('lets a JSON body through, with a charset too', () => {
    expect(isAllowedRequest('POST', { 'content-type': 'application/json', 'content-length': '20' })).toBe(true);
    expect(isAllowedRequest('POST', { 'content-type': 'Application/JSON; charset=utf-8', 'content-length': '20' })).toBe(true);
  });

  it('lets a POST with no body through (logout)', () => {
    expect(isAllowedRequest('POST', {})).toBe(true);
    expect(isAllowedRequest('POST', { 'content-length': '0' })).toBe(true);
  });

  it.each(['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'text/plain'])(
    'refuses a body sent as %s, the types a cross-site form can send',
    (type) => {
      expect(isAllowedRequest('POST', { 'content-type': type, 'content-length': '20' })).toBe(false);
    },
  );

  it('refuses a body with no content type', () => {
    expect(isAllowedRequest('POST', { 'content-length': '20' })).toBe(false);
  });

  it('refuses a chunked body that is not JSON', () => {
    expect(isAllowedRequest('POST', { 'transfer-encoding': 'chunked', 'content-type': 'text/plain' })).toBe(false);
  });
});
