import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapIdentitySeed, toBasisPoints, toCents } from './seed-mapper.js';

const base = {
  supervisores: [{ id: 'S01', nome: 'Marta Fernandes' }],
  vendedores: [{ id: 'V01', nome: 'Carlos Menezes', supervisor_id: 'S01', alcada_desconto_percentual: 5 }],
  clientes: [
    {
      id: 'C001',
      nome_fantasia: 'Mercadinho São José',
      razao_social: 'Mercadinho São José Ltda',
      cnpj: '99.671.412/0001-10',
      vendedor_id: 'V01',
      tabela_preco_id: 'TP01',
      limite_credito: 5000,
      credito_utilizado: 1200,
      cidade: 'Fortaleza',
      uf: 'CE',
    },
  ],
};

describe('unit conversions', () => {
  it('converts reais to cents and percent to basis points', () => {
    expect(toCents(5000)).toBe(500_000);
    expect(toCents(11650.1)).toBe(1_165_010);
    expect(toBasisPoints(5)).toBe(500);
    expect(toBasisPoints(2.5)).toBe(250);
  });
});

describe('mapIdentitySeed', () => {
  it('maps people to English fields, cents and basis points', () => {
    const seed = mapIdentitySeed(base);
    expect(seed.sellers[0]).toEqual({ id: 'V01', name: 'Carlos Menezes', supervisorId: 'S01', discountLimitBp: 500 });
    expect(seed.clients[0]).toMatchObject({ id: 'C001', creditLimitCents: 500_000, creditUsedCents: 120_000 });
  });

  it('keeps a missing price table as null', () => {
    const seed = mapIdentitySeed({ ...base, clientes: [{ ...base.clientes[0], tabela_preco_id: null }] });
    expect(seed.clients[0].priceTableId).toBeNull();
  });

  it('rejects a seller whose supervisor does not exist', () => {
    expect(() => mapIdentitySeed({ ...base, vendedores: [{ ...base.vendedores[0], supervisor_id: 'S99' }] })).toThrow(
      /unknown supervisor S99/,
    );
  });

  it('rejects a client whose seller does not exist', () => {
    expect(() => mapIdentitySeed({ ...base, clientes: [{ ...base.clientes[0], vendedor_id: 'V99' }] })).toThrow(
      /unknown seller V99/,
    );
  });

  it('accepts the seed slice, including the client without a price table', () => {
    const file = new URL('../../../seed/seed.json', import.meta.url);
    const seed = mapIdentitySeed(JSON.parse(readFileSync(file, 'utf8')));

    expect(seed.supervisors).toHaveLength(1);
    expect(seed.sellers.map((s) => s.discountLimitBp)).toEqual([500, 700, 300]);
    expect(seed.clients).toHaveLength(10);
    expect(seed.clients.find((c) => c.id === 'C004')?.priceTableId).toBeNull();
    // C002: 12000 limit, 11650 used -> 350 left.
    const c002 = seed.clients.find((c) => c.id === 'C002');
    expect(c002 && c002.creditLimitCents - c002.creditUsedCents).toBe(35_000);
  });
});
