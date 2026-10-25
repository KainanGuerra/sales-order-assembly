import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';
import messages from '../i18n/locales/pt-BR.json';

// "1 item", not "1 itens".
describe('pt-BR plurals', () => {
  const i18n = createI18n({ legacy: false, locale: 'pt-BR', messages: { 'pt-BR': messages } });
  const t = i18n.global.t;

  it('says item for one and itens for the others', () => {
    expect(t('history.items', { n: 1 }, 1)).toBe('1 item');
    expect(t('history.items', { n: 3 }, 3)).toBe('3 itens');
    expect(t('history.items', { n: 0 }, 0)).toBe('0 itens');
  });
});
