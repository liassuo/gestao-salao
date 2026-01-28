import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    client: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    debt: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createClientDto = {
        name: 'John Doe',
        phone: '11999999999',
        email: 'john@example.com',
      };

      const expectedResult = {
        id: '123',
        ...createClientDto,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.client.create.mockResolvedValue(expectedResult);

      const result = await service.create(createClientDto);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.client.create).toHaveBeenCalledWith({
        data: {
          name: createClientDto.name,
          phone: createClientDto.phone,
          email: createClientDto.email,
          password: undefined,
          googleId: undefined,
          notes: undefined,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return all clients without filters', async () => {
      const clients = [
        { id: '1', name: 'Client 1', phone: '111', email: 'c1@test.com' },
        { id: '2', name: 'Client 2', phone: '222', email: 'c2@test.com' },
      ];

      mockPrismaService.client.findMany.mockResolvedValue(clients);

      const result = await service.findAll();

      expect(result).toEqual(clients);
      expect(mockPrismaService.client.findMany).toHaveBeenCalled();
    });

    it('should filter clients by search term', async () => {
      const clients = [{ id: '1', name: 'John', phone: '111', email: 'john@test.com' }];

      mockPrismaService.client.findMany.mockResolvedValue(clients);

      const result = await service.findAll({ search: 'John' });

      expect(result).toEqual(clients);
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter clients with debts', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);

      await service.findAll({ hasDebts: true });

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hasDebts: true,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      const client = {
        id: '123',
        name: 'John Doe',
        phone: '111',
        email: 'john@test.com',
        appointments: [],
        debts: [],
      };

      mockPrismaService.client.findUnique.mockResolvedValue(client);

      const result = await service.findOne('123');

      expect(result).toEqual(client);
    });

    it('should throw NotFoundException when client not found', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const existingClient = { id: '123', name: 'John', phone: '111' };
      const updateDto = { name: 'John Updated' };
      const updatedClient = { ...existingClient, ...updateDto };

      mockPrismaService.client.findUnique.mockResolvedValue(existingClient);
      mockPrismaService.client.update.mockResolvedValue(updatedClient);

      const result = await service.update('123', updateDto);

      expect(result.name).toBe('John Updated');
    });

    it('should throw NotFoundException when updating non-existent client', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a client', async () => {
      const client = { id: '123', name: 'John', isActive: true };

      mockPrismaService.client.findUnique.mockResolvedValue(client);
      mockPrismaService.client.update.mockResolvedValue({ ...client, isActive: false });

      await service.remove('123');

      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when removing non-existent client', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDebtStatus', () => {
    it('should set hasDebts to true when client has active debts', async () => {
      mockPrismaService.debt.count.mockResolvedValue(2);
      mockPrismaService.client.update.mockResolvedValue({});

      await service.updateDebtStatus('123');

      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { hasDebts: true },
      });
    });

    it('should set hasDebts to false when client has no active debts', async () => {
      mockPrismaService.debt.count.mockResolvedValue(0);
      mockPrismaService.client.update.mockResolvedValue({});

      await service.updateDebtStatus('123');

      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { hasDebts: false },
      });
    });
  });
});
