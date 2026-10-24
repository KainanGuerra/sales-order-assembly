import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { ClientRow, PeopleRepository, SellerRow } from '../repository/people.repository.js';
import { PeopleService } from './people.service.js';

const v01: SellerRow = { id: 'V01', name: 'Carlos Menezes', supervisorId: 'S01', discountLimitBp: 500 };
const c001: ClientRow = {
  id: 'C001',
  tradeName: 'Mercadinho São José',
  legalName: 'Mercadinho São José Ltda',
  cnpj: '99.671.412/0001-10',
  sellerId: 'V01',
  priceTableId: 'TP01',
  creditLimitCents: 500_000,
  creditUsedCents: 120_000,
  city: 'Fortaleza',
  state: 'CE',
};
const c004: ClientRow = { ...c001, id: 'C004', cnpj: '45.948.749/0001-01', priceTableId: null };

function build() {
  const repository = {
    listSupervisors: vi.fn().mockResolvedValue([{ id: 'S01', name: 'Marta Fernandes' }]),
    listSellers: vi.fn().mockResolvedValue([v01]),
    findSupervisor: vi.fn().mockResolvedValue({ id: 'S01', name: 'Marta Fernandes' }),
    findSeller: vi.fn().mockImplementation(async (id: string) => (id === 'V01' ? v01 : null)),
    listClientsBySeller: vi.fn().mockResolvedValue([c001, c004]),
    findClient: vi.fn().mockImplementation(async (id: string) => ({ C001: c001, C004: c004 })[id] ?? null),
  };
  const service = new PeopleService(repository as unknown as PeopleRepository, { DEFAULT_PRICE_TABLE_ID: 'TP01' } as Env);
  return { service, repository };
}

describe('PeopleService.loginOptions', () => {
  it('lists supervisors and sellers by id and name only', async () => {
    const { service } = build();
    expect(await service.loginOptions()).toEqual({
      supervisors: [{ id: 'S01', name: 'Marta Fernandes' }],
      sellers: [{ id: 'V01', name: 'Carlos Menezes' }],
    });
  });
});

describe('PeopleService.validatePick', () => {
  it('returns the seller profile with the discount limit', async () => {
    const { service } = build();
    expect(await service.validatePick({ role: 'SELLER', id: 'V01' })).toEqual({
      role: 'SELLER',
      id: 'V01',
      name: 'Carlos Menezes',
      supervisorId: 'S01',
      discountLimitBp: 500,
    });
  });

  it('returns the supervisor profile', async () => {
    const { service } = build();
    expect(await service.validatePick({ role: 'SUPERVISOR', id: 'S01' })).toEqual({
      role: 'SUPERVISOR',
      id: 'S01',
      name: 'Marta Fernandes',
    });
  });

  it('rejects an unknown seller', async () => {
    const { service } = build();
    await expect(service.validatePick({ role: 'SELLER', id: 'V99' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a supervisor id picked as a seller', async () => {
    const { service } = build();
    await expect(service.validatePick({ role: 'SELLER', id: 'S01' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PeopleService.listPortfolio', () => {
  it('lists the clients of the seller who asks, with credit and price table', async () => {
    const { service } = build();
    const items = await service.listPortfolio({ role: 'SELLER', id: 'V01' }, 'V01');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'C001', priceTableId: 'TP01', priceTableFallback: false, creditAvailableCents: 380_000 });
  });

  it('flags the fallback for a client without a price table', async () => {
    const { service } = build();
    const items = await service.listPortfolio({ role: 'SELLER', id: 'V01' }, 'V01');
    expect(items[1]).toMatchObject({ id: 'C004', priceTableId: 'TP01', priceTableFallback: true });
  });

  it("refuses a seller who asks for another seller's portfolio, without reading it", async () => {
    const { service, repository } = build();
    await expect(service.listPortfolio({ role: 'SELLER', id: 'V02' }, 'V01')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listClientsBySeller).not.toHaveBeenCalled();
  });

  it('lets the supervisor of the seller read the portfolio', async () => {
    const { service } = build();
    expect(await service.listPortfolio({ role: 'SUPERVISOR', id: 'S01' }, 'V01')).toHaveLength(2);
  });

  it('refuses a supervisor of another team', async () => {
    const { service } = build();
    await expect(service.listPortfolio({ role: 'SUPERVISOR', id: 'S02' }, 'V01')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('answers not found for an unknown seller', async () => {
    const { service } = build();
    await expect(service.listPortfolio({ role: 'SELLER', id: 'V99' }, 'V99')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PeopleService.getClientFor', () => {
  it('returns a client of the seller who asks', async () => {
    const { service } = build();
    expect(await service.getClientFor({ role: 'SELLER', id: 'V01' }, 'C001')).toMatchObject({ id: 'C001' });
  });

  it("hides another seller's client behind the same answer as a missing one", async () => {
    const { service } = build();
    await expect(service.getClientFor({ role: 'SELLER', id: 'V02' }, 'C001')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PeopleService service-to-service reads', () => {
  it('returns a client without checking who asks', async () => {
    const { service } = build();
    expect(await service.findClient('C004')).toMatchObject({ id: 'C004', priceTableFallback: true });
  });

  it('returns null for an unknown client or seller', async () => {
    const { service } = build();
    expect(await service.findClient('C999')).toBeNull();
    expect(await service.findSeller('V99')).toBeNull();
  });
});
