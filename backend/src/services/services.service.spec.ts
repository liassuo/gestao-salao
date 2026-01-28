import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;

  const mockPrismaService = {
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointmentService: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new service', async () => {
      const createServiceDto = {
        name: 'Corte de Cabelo',
        description: 'Corte masculino',
        price: 5000, // R$ 50,00
        duration: 30, // 30 minutos
      };

      const expectedResult = {
        id: '123',
        ...createServiceDto,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.service.create.mockResolvedValue(expectedResult);

      const result = await service.create(createServiceDto);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.service.create).toHaveBeenCalledWith({
        data: {
          name: createServiceDto.name,
          description: createServiceDto.description,
          price: createServiceDto.price,
          duration: createServiceDto.duration,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return only active services by default', async () => {
      const services = [
        { id: '1', name: 'Service 1', price: 5000, duration: 30, isActive: true },
        { id: '2', name: 'Service 2', price: 3000, duration: 20, isActive: true },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(services);

      const result = await service.findAll();

      expect(result).toEqual(services);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should return all services when activeOnly is false', async () => {
      const services = [
        { id: '1', name: 'Service 1', isActive: true },
        { id: '2', name: 'Service 2', isActive: false },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(services);

      const result = await service.findAll(false);

      expect(result).toEqual(services);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      const serviceData = {
        id: '123',
        name: 'Corte',
        price: 5000,
        duration: 30,
        professionals: [],
      };

      mockPrismaService.service.findUnique.mockResolvedValue(serviceData);

      const result = await service.findOne('123');

      expect(result).toEqual(serviceData);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total price and duration for multiple services', async () => {
      const services = [
        { price: 5000, duration: 30 },
        { price: 2000, duration: 15 },
        { price: 3000, duration: 20 },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(services);

      const result = await service.calculateTotal(['id1', 'id2', 'id3']);

      expect(result).toEqual({
        totalPrice: 10000, // R$ 100,00
        totalDuration: 65, // 65 minutos
      });
    });

    it('should return zero for empty service list', async () => {
      mockPrismaService.service.findMany.mockResolvedValue([]);

      const result = await service.calculateTotal([]);

      expect(result).toEqual({
        totalPrice: 0,
        totalDuration: 0,
      });
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      const existingService = { id: '123', name: 'Corte', price: 5000 };
      const updateDto = { price: 6000 };
      const updatedService = { ...existingService, ...updateDto };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.update.mockResolvedValue(updatedService);

      const result = await service.update('123', updateDto);

      expect(result.price).toBe(6000);
    });

    it('should throw NotFoundException when updating non-existent service', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a service', async () => {
      const serviceData = { id: '123', name: 'Corte', isActive: true };

      mockPrismaService.service.findUnique.mockResolvedValue(serviceData);
      mockPrismaService.service.update.mockResolvedValue({ ...serviceData, isActive: false });

      await service.remove('123');

      expect(mockPrismaService.service.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when removing non-existent service', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
