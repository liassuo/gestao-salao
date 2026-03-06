import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  return chain;
};

describe('ServicesService', () => {
  let service: ServicesService;
  let supabaseService: SupabaseService;
  let chain: ReturnType<typeof mockChain>;

  beforeEach(async () => {
    chain = mockChain();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: SupabaseService,
          useValue: {
            from: jest.fn().mockReturnValue(chain),
          },
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Corte de Cabelo',
      description: 'Corte masculino',
      price: 5000,
      duration: 30,
    };

    const createdService = {
      id: 'uuid-1',
      name: 'Corte de Cabelo',
      description: 'Corte masculino',
      price: 5000,
      duration: 30,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('should create a service successfully', async () => {
      chain.single.mockResolvedValue({ data: createdService, error: null });

      const result = await service.create(createDto);

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.insert).toHaveBeenCalledWith({
        name: createDto.name,
        description: createDto.description,
        price: createDto.price,
        duration: createDto.duration,
      });
      expect(chain.select).toHaveBeenCalledWith(
        'id, name, description, price, duration, isActive, createdAt',
      );
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(createdService);
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('Insert failed');
      chain.single.mockResolvedValue({ data: null, error: dbError });

      await expect(service.create(createDto)).rejects.toThrow('Insert failed');
    });
  });

  describe('findAll', () => {
    const servicesList = [
      { id: '1', name: 'Barba', description: null, price: 3000, duration: 20, isActive: true },
      { id: '2', name: 'Corte', description: null, price: 5000, duration: 30, isActive: true },
    ];

    it('should return active services by default', async () => {
      chain.eq.mockResolvedValue({ data: servicesList, error: null });

      const result = await service.findAll();

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith(
        'id, name, description, price, duration, isActive',
      );
      expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(result).toEqual(servicesList);
    });

    it('should return all services when activeOnly is false', async () => {
      chain.order.mockResolvedValue({ data: servicesList, error: null });

      const result = await service.findAll(false);

      expect(chain.eq).not.toHaveBeenCalled();
      expect(result).toEqual(servicesList);
    });

    it('should return empty array when data is null', async () => {
      chain.eq.mockResolvedValue({ data: null, error: null });

      const result = await service.findAll(true);

      expect(result).toEqual([]);
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('Query failed');
      chain.eq.mockResolvedValue({ data: null, error: dbError });

      await expect(service.findAll()).rejects.toThrow('Query failed');
    });
  });

  describe('findActive', () => {
    const activeServices = [
      { id: '1', name: 'Barba', description: null, price: 3000, duration: 20 },
      { id: '2', name: 'Corte', description: null, price: 5000, duration: 30 },
    ];

    it('should return active services ordered by name', async () => {
      chain.order.mockResolvedValue({ data: activeServices, error: null });

      const result = await service.findActive();

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith(
        'id, name, description, price, duration',
      );
      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(activeServices);
    });

    it('should return empty array when data is null', async () => {
      chain.order.mockResolvedValue({ data: null, error: null });

      const result = await service.findActive();

      expect(result).toEqual([]);
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('Query failed');
      chain.order.mockResolvedValue({ data: null, error: dbError });

      await expect(service.findActive()).rejects.toThrow('Query failed');
    });
  });

  describe('findOne', () => {
    const foundService = {
      id: 'uuid-1',
      name: 'Corte de Cabelo',
      description: 'Corte masculino',
      price: 5000,
      duration: 30,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('should return a service by id', async () => {
      chain.single.mockResolvedValue({ data: foundService, error: null });

      const result = await service.findOne('uuid-1');

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(foundService);
    });

    it('should throw NotFoundException when service is not found', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when supabase returns an error', async () => {
      chain.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      await expect(service.findOne('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIds', () => {
    const services = [
      { id: '1', name: 'Corte', price: 5000, duration: 30 },
      { id: '2', name: 'Barba', price: 3000, duration: 20 },
    ];

    it('should return services matching the given ids', async () => {
      chain.eq.mockResolvedValue({ data: services, error: null });

      const result = await service.findByIds(['1', '2']);

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith('id, name, price, duration');
      expect(chain.in).toHaveBeenCalledWith('id', ['1', '2']);
      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(result).toEqual(services);
    });

    it('should return empty array when data is null', async () => {
      chain.eq.mockResolvedValue({ data: null, error: null });

      const result = await service.findByIds(['nonexistent']);

      expect(result).toEqual([]);
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('Query failed');
      chain.eq.mockResolvedValue({ data: null, error: dbError });

      await expect(service.findByIds(['1'])).rejects.toThrow('Query failed');
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total price and duration', async () => {
      const services = [
        { price: 5000, duration: 30 },
        { price: 3000, duration: 20 },
      ];
      chain.eq.mockResolvedValue({ data: services, error: null });

      const result = await service.calculateTotal(['1', '2']);

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith('price, duration');
      expect(chain.in).toHaveBeenCalledWith('id', ['1', '2']);
      expect(chain.eq).toHaveBeenCalledWith('isActive', true);
      expect(result).toEqual({ totalPrice: 8000, totalDuration: 50 });
    });

    it('should return zeros when no services found', async () => {
      chain.eq.mockResolvedValue({ data: null, error: null });

      const result = await service.calculateTotal(['nonexistent']);

      expect(result).toEqual({ totalPrice: 0, totalDuration: 0 });
    });

    it('should return correct total for a single service', async () => {
      const services = [{ price: 5000, duration: 30 }];
      chain.eq.mockResolvedValue({ data: services, error: null });

      const result = await service.calculateTotal(['1']);

      expect(result).toEqual({ totalPrice: 5000, totalDuration: 30 });
    });

    it('should throw when supabase returns an error', async () => {
      const dbError = new Error('Query failed');
      chain.eq.mockResolvedValue({ data: null, error: dbError });

      await expect(service.calculateTotal(['1'])).rejects.toThrow(
        'Query failed',
      );
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Corte Atualizado', price: 6000 };
    const existingService = { id: 'uuid-1' };
    const updatedService = {
      id: 'uuid-1',
      name: 'Corte Atualizado',
      description: 'Corte masculino',
      price: 6000,
      duration: 30,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('should update a service successfully', async () => {
      // First call: find existing service
      const findChain = mockChain();
      findChain.single.mockResolvedValue({
        data: existingService,
        error: null,
      });

      // Second call: update service
      const updateChain = mockChain();
      updateChain.single.mockResolvedValue({
        data: updatedService,
        error: null,
      });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      const result = await service.update('uuid-1', updateDto);

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(findChain.select).toHaveBeenCalledWith('id');
      expect(findChain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(findChain.single).toHaveBeenCalled();
      expect(updateChain.update).toHaveBeenCalledWith(updateDto);
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(updateChain.select).toHaveBeenCalledWith('*');
      expect(updateChain.single).toHaveBeenCalled();
      expect(result).toEqual(updatedService);
    });

    it('should throw NotFoundException when service does not exist', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when find returns error', async () => {
      chain.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      await expect(service.update('uuid-1', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when update query returns an error', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({
        data: existingService,
        error: null,
      });

      const updateChain = mockChain();
      const dbError = new Error('Update failed');
      updateChain.single.mockResolvedValue({ data: null, error: dbError });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await expect(service.update('uuid-1', updateDto)).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('remove', () => {
    const existingService = { id: 'uuid-1' };

    it('should soft delete a service by setting isActive to false', async () => {
      // First call: find existing service
      const findChain = mockChain();
      findChain.single.mockResolvedValue({
        data: existingService,
        error: null,
      });

      // Second call: update isActive to false
      const updateChain = mockChain();
      updateChain.eq.mockResolvedValue({ error: null });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await service.remove('uuid-1');

      expect(findChain.select).toHaveBeenCalledWith('id');
      expect(findChain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(findChain.single).toHaveBeenCalled();
      expect(updateChain.update).toHaveBeenCalledWith({ isActive: false });
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'uuid-1');
    });

    it('should throw NotFoundException when service does not exist', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when find returns error', async () => {
      chain.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      await expect(service.remove('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when update query returns an error', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({
        data: existingService,
        error: null,
      });

      const updateChain = mockChain();
      const dbError = new Error('Update failed');
      updateChain.eq.mockResolvedValue({ error: dbError });

      (supabaseService.from as jest.Mock)
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await expect(service.remove('uuid-1')).rejects.toThrow('Update failed');
    });
  });

  describe('getStatistics', () => {
    const foundService = { id: 'uuid-1', name: 'Corte de Cabelo', price: 5000 };

    it('should return service with attendedCount and totalRevenue', async () => {
      chain.single.mockResolvedValue({ data: foundService, error: null });

      const result = await service.getStatistics('uuid-1');

      expect(supabaseService.from).toHaveBeenCalledWith('services');
      expect(chain.select).toHaveBeenCalledWith('id, name, price');
      expect(chain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual({
        ...foundService,
        attendedCount: 0,
        totalRevenue: 0,
      });
    });

    it('should throw NotFoundException when service is not found', async () => {
      chain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.getStatistics('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when supabase returns an error', async () => {
      chain.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      await expect(service.getStatistics('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
