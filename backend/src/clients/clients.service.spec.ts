import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AsaasService } from '../asaas/asaas.service';
import { CreateClientDto, UpdateClientDto } from './dto';

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  return chain;
};

const mockAsaasService = {
  configured: false,
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
};

describe('ClientsService', () => {
  let service: ClientsService;
  let supabaseService: SupabaseService;
  let chain: ReturnType<typeof mockChain>;

  beforeEach(async () => {
    chain = mockChain();

    const mockSupabaseService = {
      from: jest.fn().mockReturnValue(chain),
    };

    mockAsaasService.configured = false;
    mockAsaasService.createCustomer.mockReset();
    mockAsaasService.updateCustomer.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AsaasService, useValue: mockAsaasService },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateClientDto = {
      name: 'Maria Silva',
      phone: '11999999999',
      email: 'maria@example.com',
      cpf: '12345678900',
    };

    const createdClient = { id: 'uuid-1', ...dto, isActive: true, hasDebts: false };

    it('should insert a client and return it', async () => {
      chain.single.mockResolvedValue({ data: createdClient, error: null });

      const result = await service.create(dto);

      expect(supabaseService.from).toHaveBeenCalledWith('clients');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: dto.name, phone: dto.phone }),
      );
      expect(result).toEqual(createdClient);
    });

    it('should throw when supabase returns an error on insert', async () => {
      const dbError = new Error('duplicate key');
      chain.single.mockResolvedValue({ data: null, error: dbError });

      await expect(service.create(dto)).rejects.toThrow('duplicate key');
    });

    it('should sync with Asaas when configured is true', async () => {
      mockAsaasService.configured = true;
      mockAsaasService.createCustomer.mockResolvedValue({ id: 'asaas-cust-1' });

      // First call: insert -> select -> single (create client)
      chain.single.mockResolvedValue({ data: createdClient, error: null });
      // Second call: update asaasCustomerId — supabase.from returns a new chain
      // but we reuse the same mock; the update().eq() call does not need to resolve
      // because the code does not await a .single() on the update chain.

      await service.create(dto);

      expect(mockAsaasService.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          externalReference: createdClient.id,
        }),
      );
      expect(chain.update).toHaveBeenCalledWith({ asaasCustomerId: 'asaas-cust-1' });
    });

    it('should not sync with Asaas when configured is false', async () => {
      mockAsaasService.configured = false;
      chain.single.mockResolvedValue({ data: createdClient, error: null });

      await service.create(dto);

      expect(mockAsaasService.createCustomer).not.toHaveBeenCalled();
    });

    it('should not throw when Asaas sync fails', async () => {
      mockAsaasService.configured = true;
      mockAsaasService.createCustomer.mockRejectedValue(new Error('Asaas down'));
      chain.single.mockResolvedValue({ data: createdClient, error: null });

      const result = await service.create(dto);

      expect(result).toEqual(createdClient);
    });

    it('should handle null optional fields', async () => {
      const minimalDto: CreateClientDto = { name: 'João', phone: '11888888888' };
      chain.single.mockResolvedValue({
        data: { id: 'uuid-2', name: 'João', phone: '11888888888' },
        error: null,
      });

      await service.create(minimalDto);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'João',
          phone: '11888888888',
          email: null,
          cpf: null,
        }),
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    const rawClients = [
      {
        id: 'uuid-1',
        name: 'Ana',
        appointment_count: [{ count: 5 }],
        debt_count: [{ count: 1 }],
      },
      {
        id: 'uuid-2',
        name: 'Bruno',
        appointment_count: [{ count: 0 }],
        debt_count: [{ count: 0 }],
      },
    ];

    it('should return all clients with _count transformation', async () => {
      chain.order.mockResolvedValue({ data: rawClients, error: null });

      const result = await service.findAll();

      expect(supabaseService.from).toHaveBeenCalledWith('clients');
      expect(chain.select).toHaveBeenCalledWith(
        '*, appointment_count:appointments(count), debt_count:debts(count)',
      );
      expect(result).toEqual([
        { id: 'uuid-1', name: 'Ana', _count: { appointments: 5, debts: 1 } },
        { id: 'uuid-2', name: 'Bruno', _count: { appointments: 0, debts: 0 } },
      ]);
    });

    it('should apply isActive filter', async () => {
      chain.order.mockResolvedValue({ data: [], error: null });

      await service.findAll({ isActive: true });

      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
    });

    it('should apply hasDebts filter', async () => {
      chain.order.mockResolvedValue({ data: [], error: null });

      await service.findAll({ hasDebts: true });

      expect(chain.eq).toHaveBeenCalledWith('hasDebts', true);
    });

    it('should apply search filter with or clause', async () => {
      chain.order.mockResolvedValue({ data: [], error: null });

      await service.findAll({ search: 'Ana' });

      expect(chain.or).toHaveBeenCalledWith(
        'name.ilike.%Ana%,email.ilike.%Ana%,phone.ilike.%Ana%,cpf.ilike.%Ana%',
      );
    });

    it('should apply all filters together', async () => {
      chain.order.mockResolvedValue({ data: [], error: null });

      await service.findAll({ search: 'test', hasDebts: false, isActive: true });

      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(chain.eq).toHaveBeenCalledWith('hasDebts', false);
      expect(chain.or).toHaveBeenCalled();
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('query failed');
      chain.order.mockResolvedValue({ data: null, error: dbError });

      await expect(service.findAll()).rejects.toThrow('query failed');
    });

    it('should return empty array when data is null', async () => {
      chain.order.mockResolvedValue({ data: null, error: null });

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should handle missing appointment_count and debt_count gracefully', async () => {
      chain.order.mockResolvedValue({
        data: [{ id: 'uuid-3', name: 'Carlos' }],
        error: null,
      });

      const result = await service.findAll();

      expect(result).toEqual([
        { id: 'uuid-3', name: 'Carlos', _count: { appointments: 0, debts: 0 } },
      ]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a client by id', async () => {
      const client = { id: 'uuid-1', name: 'Maria' };
      chain.single.mockResolvedValue({ data: client, error: null });

      const result = await service.findOne('uuid-1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(result).toEqual(client);
    });

    it('should throw NotFoundException when client is not found (null data)', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when supabase returns an error', async () => {
      chain.single.mockResolvedValue({ data: null, error: new Error('not found') });

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByEmail ──────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('should return a client when email matches', async () => {
      const client = { id: 'uuid-1', email: 'maria@example.com' };
      chain.single.mockResolvedValue({ data: client, error: null });

      const result = await service.findByEmail('maria@example.com');

      expect(chain.eq).toHaveBeenCalledWith('email', 'maria@example.com');
      expect(result).toEqual(client);
    });

    it('should return null when no client matches', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });

    it('should return undefined/null when supabase errors (no throw)', async () => {
      chain.single.mockResolvedValue({ data: undefined, error: new Error('err') });

      const result = await service.findByEmail('bad@example.com');

      expect(result).toBeUndefined();
    });
  });

  // ─── findClientsWithDebts ─────────────────────────────────────────────

  describe('findClientsWithDebts', () => {
    it('should filter by hasDebts=true and isActive=true', async () => {
      const debtClients = [{ id: 'uuid-1', name: 'Devedor', hasDebts: true }];
      chain.order.mockResolvedValue({ data: debtClients, error: null });

      const result = await service.findClientsWithDebts();

      expect(chain.eq).toHaveBeenCalledWith('hasDebts', true);
      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(debtClients);
    });

    it('should return empty array when data is null', async () => {
      chain.order.mockResolvedValue({ data: null, error: null });

      const result = await service.findClientsWithDebts();

      expect(result).toEqual([]);
    });

    it('should throw when supabase returns an error', async () => {
      chain.order.mockResolvedValue({ data: null, error: new Error('db error') });

      await expect(service.findClientsWithDebts()).rejects.toThrow('db error');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateClientDto = { name: 'Maria Atualizada' };
    const existingClient = { id: 'uuid-1' };
    const updatedClient = {
      id: 'uuid-1',
      name: 'Maria Atualizada',
      asaasCustomerId: null,
    };

    it('should check existence and update the client', async () => {
      // First single() call: findOne check
      chain.single
        .mockResolvedValueOnce({ data: existingClient, error: null })
        // Second single() call: update result
        .mockResolvedValueOnce({ data: updatedClient, error: null });

      const result = await service.update('uuid-1', dto);

      expect(chain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(chain.update).toHaveBeenCalledWith(dto);
      expect(result).toEqual(updatedClient);
    });

    it('should throw NotFoundException when client does not exist', async () => {
      chain.single.mockResolvedValue({ data: null, error: new Error('not found') });

      await expect(service.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });

    it('should sync with Asaas when configured and client has asaasCustomerId', async () => {
      mockAsaasService.configured = true;
      mockAsaasService.updateCustomer.mockResolvedValue({});

      const clientWithAsaas = {
        id: 'uuid-1',
        name: 'Maria Atualizada',
        email: 'maria@example.com',
        phone: '11999999999',
        cpf: '12345678900',
        asaasCustomerId: 'asaas-cust-1',
      };

      chain.single
        .mockResolvedValueOnce({ data: existingClient, error: null })
        .mockResolvedValueOnce({ data: clientWithAsaas, error: null });

      await service.update('uuid-1', dto);

      expect(mockAsaasService.updateCustomer).toHaveBeenCalledWith(
        'asaas-cust-1',
        expect.objectContaining({ name: dto.name }),
      );
    });

    it('should not sync with Asaas when configured but no asaasCustomerId', async () => {
      mockAsaasService.configured = true;

      chain.single
        .mockResolvedValueOnce({ data: existingClient, error: null })
        .mockResolvedValueOnce({ data: updatedClient, error: null });

      await service.update('uuid-1', dto);

      expect(mockAsaasService.updateCustomer).not.toHaveBeenCalled();
    });

    it('should not throw when Asaas sync fails on update', async () => {
      mockAsaasService.configured = true;
      mockAsaasService.updateCustomer.mockRejectedValue(new Error('Asaas down'));

      const clientWithAsaas = {
        id: 'uuid-1',
        name: 'Maria Atualizada',
        asaasCustomerId: 'asaas-cust-1',
      };

      chain.single
        .mockResolvedValueOnce({ data: existingClient, error: null })
        .mockResolvedValueOnce({ data: clientWithAsaas, error: null });

      const result = await service.update('uuid-1', dto);

      expect(result).toEqual(clientWithAsaas);
    });

    it('should throw when supabase update returns an error', async () => {
      const dbError = new Error('update failed');
      chain.single
        .mockResolvedValueOnce({ data: existingClient, error: null })
        .mockResolvedValueOnce({ data: null, error: dbError });

      await expect(service.update('uuid-1', dto)).rejects.toThrow('update failed');
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete by setting isActive to false', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: { id: 'uuid-1' }, error: null });
      const updateChain = mockChain();
      updateChain.eq.mockResolvedValue({ error: null });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await service.remove('uuid-1');

      expect(updateChain.update).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: null, error: new Error('not found') });
      (supabaseService.from as jest.Mock).mockReturnValueOnce(findChain);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw when supabase update returns an error on remove', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: { id: 'uuid-1' }, error: null });
      const updateChain = mockChain();
      updateChain.eq.mockResolvedValue({ error: new Error('delete failed') });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await expect(service.remove('uuid-1')).rejects.toThrow('delete failed');
    });
  });

  // ─── updateDebtStatus ─────────────────────────────────────────────────

  describe('updateDebtStatus', () => {
    it('should set hasDebts to true when there are unsettled debts', async () => {
      const debtsChain = mockChain();
      // from('debts').select().eq('clientId').eq('isSettled') — two .eq calls, second is terminal
      debtsChain.eq
        .mockReturnValueOnce(debtsChain) // .eq('clientId', ...)
        .mockResolvedValueOnce({ count: 3 }); // .eq('isSettled', false) — terminal

      const clientsChain = mockChain();
      clientsChain.eq.mockResolvedValue({ error: null });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(debtsChain)
        .mockReturnValueOnce(clientsChain);

      await service.updateDebtStatus('uuid-1');

      expect(supabaseService.from).toHaveBeenCalledWith('debts');
      expect(debtsChain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(supabaseService.from).toHaveBeenCalledWith('clients');
      expect(clientsChain.update).toHaveBeenCalledWith({ hasDebts: true });
    });

    it('should set hasDebts to false when there are no unsettled debts', async () => {
      const debtsChain = mockChain();
      debtsChain.eq
        .mockReturnValueOnce(debtsChain)
        .mockResolvedValueOnce({ count: 0 });

      const clientsChain = mockChain();
      clientsChain.eq.mockResolvedValue({ error: null });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(debtsChain)
        .mockReturnValueOnce(clientsChain);

      await service.updateDebtStatus('uuid-1');

      expect(clientsChain.update).toHaveBeenCalledWith({ hasDebts: false });
    });

    it('should set hasDebts to false when count is null', async () => {
      const debtsChain = mockChain();
      debtsChain.eq
        .mockReturnValueOnce(debtsChain)
        .mockResolvedValueOnce({ count: null });

      const clientsChain = mockChain();
      clientsChain.eq.mockResolvedValue({ error: null });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(debtsChain)
        .mockReturnValueOnce(clientsChain);

      await service.updateDebtStatus('uuid-1');

      expect(clientsChain.update).toHaveBeenCalledWith({ hasDebts: false });
    });
  });
});
