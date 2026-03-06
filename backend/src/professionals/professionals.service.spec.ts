import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { SupabaseService } from '../supabase/supabase.service';

const chains: Record<string, any> = {};

const mockChain = () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  return chain;
};

const mockSupabase = {
  from: jest.fn().mockImplementation((table: string) => {
    if (!chains[table]) chains[table] = mockChain();
    return chains[table];
  }),
  client: {
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
      }),
    },
  },
};

describe('ProfessionalsService', () => {
  let service: ProfessionalsService;

  beforeEach(async () => {
    // Reset all chains and from mock so each test starts fresh
    Object.keys(chains).forEach((key) => delete chains[key]);
    mockSupabase.from.mockReset();
    mockSupabase.from.mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = mockChain();
      return chains[table];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<ProfessionalsService>(ProfessionalsService);
  });

  // ─── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a professional without services', async () => {
      const dto = {
        name: 'Ana',
        phone: '11999999999',
        email: 'ana@test.com',
        commissionRate: 30,
      };

      const created = { id: 'prof1', ...dto, avatarUrl: null, workingHours: [] };

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({ data: created, error: null });

      const result = await service.create(dto);

      expect(mockSupabase.from).toHaveBeenCalledWith('professionals');
      expect(chains['professionals'].insert).toHaveBeenCalledWith({
        name: 'Ana',
        phone: '11999999999',
        email: 'ana@test.com',
        avatarUrl: null,
        commissionRate: 30,
        workingHours: [],
      });
      expect(result).toEqual(created);
      // professional_services should NOT have been called
      expect(mockSupabase.from).not.toHaveBeenCalledWith('professional_services');
    });

    it('should create a professional and connect services when serviceIds provided', async () => {
      const dto = {
        name: 'Bruno',
        phone: '11888888888',
        commissionRate: 25,
        serviceIds: ['svc1', 'svc2'],
      };

      const created = { id: 'prof2', name: 'Bruno', phone: '11888888888', avatarUrl: null, commissionRate: 25, workingHours: [] };

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({ data: created, error: null });

      chains['professional_services'] = mockChain();
      chains['professional_services'].insert.mockResolvedValue({ data: null, error: null });

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockSupabase.from).toHaveBeenCalledWith('professional_services');
      expect(chains['professional_services'].insert).toHaveBeenCalledTimes(2);
      expect(chains['professional_services'].insert).toHaveBeenCalledWith({
        professionalId: 'prof2',
        serviceId: 'svc1',
      });
      expect(chains['professional_services'].insert).toHaveBeenCalledWith({
        professionalId: 'prof2',
        serviceId: 'svc2',
      });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return professionals with mapped services and appointment count', async () => {
      const raw = [
        {
          id: 'prof1',
          name: 'Ana',
          isActive: true,
          appointment_count: [{ count: 5 }],
          professional_services: [
            { serviceId: 'svc1', service: { id: 'svc1', name: 'Corte' } },
            { serviceId: 'svc2', service: { id: 'svc2', name: 'Barba' } },
          ],
        },
      ];

      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({ data: raw, error: null });

      const result = await service.findAll();

      expect(result).toEqual([
        {
          id: 'prof1',
          name: 'Ana',
          isActive: true,
          services: [
            { id: 'svc1', name: 'Corte' },
            { id: 'svc2', name: 'Barba' },
          ],
          _count: { appointments: 5 },
        },
      ]);
    });

    it('should handle null professional_services and appointment_count', async () => {
      const raw = [
        {
          id: 'prof1',
          name: 'Carlos',
          appointment_count: null,
          professional_services: null,
        },
      ];

      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({ data: raw, error: null });

      const result = await service.findAll();

      expect(result).toEqual([
        {
          id: 'prof1',
          name: 'Carlos',
          services: [],
          _count: { appointments: 0 },
        },
      ]);
    });
  });

  // ─── findActive ───────────────────────────────────────────────────────

  describe('findActive', () => {
    it('should return active professionals with serviceIds', async () => {
      const raw = [
        {
          id: 'prof1',
          name: 'Ana',
          avatarUrl: 'avatar.jpg',
          professional_services: [{ serviceId: 'svc1' }, { serviceId: 'svc2' }],
        },
      ];

      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({ data: raw, error: null });

      const result = await service.findActive();

      expect(result).toEqual([
        {
          id: 'prof1',
          name: 'Ana',
          avatarUrl: 'avatar.jpg',
          serviceIds: ['svc1', 'svc2'],
        },
      ]);
    });

    it('should return empty serviceIds when professional_services is null', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].order.mockResolvedValue({
        data: [{ id: 'prof1', name: 'Ana', avatarUrl: null, professional_services: null }],
        error: null,
      });

      const result = await service.findActive();

      expect(result[0].serviceIds).toEqual([]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a professional when found', async () => {
      const prof = { id: 'prof1', name: 'Ana', isActive: true };

      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({ data: prof, error: null });

      const result = await service.findOne('prof1');

      expect(result).toEqual(prof);
      expect(chains['professionals'].eq).toHaveBeenCalledWith('id', 'prof1');
    });

    it('should throw NotFoundException when professional not found', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({ data: null, error: null });

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException on supabase error', async () => {
      chains['professionals'] = mockChain();
      chains['professionals'].single.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAvailableForBooking ──────────────────────────────────────────

  describe('findAvailableForBooking', () => {
    const date = '2025-01-06'; // Monday → getUTCDay() = 1

    it('should return professionals available for the given services and date', async () => {
      // _ProfessionalToService: prof1 linked to svc1
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({
        data: [{ A: 'prof1', B: 'svc1' }],
        error: null,
      });

      // professionals: prof1 is active, works on Monday (dayOfWeek 1)
      chains['professionals'] = mockChain();
      chains['professionals'].in.mockResolvedValue({
        data: [
          {
            id: 'prof1',
            name: 'Ana',
            phone: '11999',
            email: 'ana@test.com',
            avatarUrl: 'avatar.jpg',
            workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
          },
        ],
        error: null,
      });

      // time_blocks: no blocks
      chains['time_blocks'] = mockChain();
      chains['time_blocks'].gte.mockResolvedValue({ data: [], error: null });

      const result = await service.findAvailableForBooking(['svc1'], date);

      expect(result).toEqual([
        {
          id: 'prof1',
          name: 'Ana',
          phone: '11999',
          email: 'ana@test.com',
          avatarUrl: 'avatar.jpg',
        },
      ]);
    });

    it('should return empty when no professionals linked to service', async () => {
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({ data: [], error: null });

      const result = await service.findAvailableForBooking(['svc1'], date);

      expect(result).toEqual([]);
      // Should not even query professionals
      expect(mockSupabase.from).not.toHaveBeenCalledWith('professionals');
    });

    it('should exclude professionals who do not work on the given day', async () => {
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({
        data: [{ A: 'prof1', B: 'svc1' }],
        error: null,
      });

      // prof1 only works on Tuesday (dayOfWeek 2), not Monday (1)
      chains['professionals'] = mockChain();
      chains['professionals'].in.mockResolvedValue({
        data: [
          {
            id: 'prof1',
            name: 'Ana',
            phone: '11999',
            email: 'ana@test.com',
            avatarUrl: null,
            workingHours: [{ dayOfWeek: 2, startTime: '09:00', endTime: '18:00' }],
          },
        ],
        error: null,
      });

      const result = await service.findAvailableForBooking(['svc1'], date);

      expect(result).toEqual([]);
    });

    it('should exclude professionals with 8h+ time blocks on the date', async () => {
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({
        data: [{ A: 'prof1', B: 'svc1' }],
        error: null,
      });

      chains['professionals'] = mockChain();
      chains['professionals'].in.mockResolvedValue({
        data: [
          {
            id: 'prof1',
            name: 'Ana',
            phone: '11999',
            email: 'ana@test.com',
            avatarUrl: null,
            workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
          },
        ],
        error: null,
      });

      // 8-hour block covering the whole day
      chains['time_blocks'] = mockChain();
      chains['time_blocks'].gte.mockResolvedValue({
        data: [
          {
            professionalId: 'prof1',
            startTime: '2025-01-06T08:00:00.000Z',
            endTime: '2025-01-06T16:00:00.000Z', // exactly 8h
          },
        ],
        error: null,
      });

      const result = await service.findAvailableForBooking(['svc1'], date);

      expect(result).toEqual([]);
    });

    it('should NOT exclude professionals with time blocks shorter than 8h', async () => {
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({
        data: [{ A: 'prof1', B: 'svc1' }],
        error: null,
      });

      chains['professionals'] = mockChain();
      chains['professionals'].in.mockResolvedValue({
        data: [
          {
            id: 'prof1',
            name: 'Ana',
            phone: '11999',
            email: 'ana@test.com',
            avatarUrl: null,
            workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
          },
        ],
        error: null,
      });

      // 2-hour block — should NOT exclude
      chains['time_blocks'] = mockChain();
      chains['time_blocks'].gte.mockResolvedValue({
        data: [
          {
            professionalId: 'prof1',
            startTime: '2025-01-06T10:00:00.000Z',
            endTime: '2025-01-06T12:00:00.000Z',
          },
        ],
        error: null,
      });

      const result = await service.findAvailableForBooking(['svc1'], date);

      expect(result).toEqual([
        {
          id: 'prof1',
          name: 'Ana',
          phone: '11999',
          email: 'ana@test.com',
          avatarUrl: null,
        },
      ]);
    });

    it('should only return professionals linked to ALL requested services', async () => {
      // prof1 linked to svc1 only, prof2 linked to svc1 and svc2
      chains['_ProfessionalToService'] = mockChain();
      chains['_ProfessionalToService'].in.mockResolvedValue({
        data: [
          { A: 'prof1', B: 'svc1' },
          { A: 'prof2', B: 'svc1' },
          { A: 'prof2', B: 'svc2' },
        ],
        error: null,
      });

      // Only prof2 should be queried (eligible for both svc1 & svc2)
      chains['professionals'] = mockChain();
      chains['professionals'].in.mockResolvedValue({
        data: [
          {
            id: 'prof2',
            name: 'Bruno',
            phone: '11888',
            email: 'bruno@test.com',
            avatarUrl: null,
            workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
          },
        ],
        error: null,
      });

      chains['time_blocks'] = mockChain();
      chains['time_blocks'].gte.mockResolvedValue({ data: [], error: null });

      const result = await service.findAvailableForBooking(['svc1', 'svc2'], date);

      // The .in call for professionals should only include prof2
      expect(chains['professionals'].in).toHaveBeenCalledWith('id', ['prof2']);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bruno');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update professional and sync services when serviceIds provided', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: { id: 'prof1' }, error: null });

      const updateChain = mockChain();
      updateChain.single.mockResolvedValue({
        data: { id: 'prof1', name: 'Updated Ana', phone: '11999' },
        error: null,
      });

      const psDeleteChain = mockChain();
      psDeleteChain.eq.mockResolvedValue({ data: null, error: null });

      const psInsertChain1 = mockChain();
      psInsertChain1.insert.mockResolvedValue({ data: null, error: null });

      const psInsertChain2 = mockChain();
      psInsertChain2.insert.mockResolvedValue({ data: null, error: null });

      // Order: find prof, update prof, delete links, insert svc3, insert svc4
      mockSupabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(psDeleteChain)
        .mockReturnValueOnce(psInsertChain1)
        .mockReturnValueOnce(psInsertChain2);

      const result = await service.update('prof1', {
        name: 'Updated Ana',
        serviceIds: ['svc3', 'svc4'],
      });

      expect(result).toEqual({ id: 'prof1', name: 'Updated Ana', phone: '11999' });
      expect(psDeleteChain.delete).toHaveBeenCalled();
      expect(psInsertChain1.insert).toHaveBeenCalledWith({
        professionalId: 'prof1',
        serviceId: 'svc3',
      });
      expect(psInsertChain2.insert).toHaveBeenCalledWith({
        professionalId: 'prof1',
        serviceId: 'svc4',
      });
    });

    it('should throw NotFoundException when professional does not exist', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValueOnce(findChain);

      await expect(service.update('missing', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete a professional by setting isActive to false', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: { id: 'prof1' }, error: null });

      const updateChain = mockChain();
      updateChain.eq.mockResolvedValue({ error: null });

      mockSupabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(updateChain);

      await service.remove('prof1');

      expect(updateChain.update).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw NotFoundException when professional does not exist', async () => {
      const findChain = mockChain();
      findChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValueOnce(findChain);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadAvatar ─────────────────────────────────────────────────────

  describe('uploadAvatar', () => {
    it('should upload file to storage and return public URL', async () => {
      const file = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = await service.uploadAvatar(file);

      expect(mockSupabase.client.storage.from).toHaveBeenCalledWith('professional-avatars');
      expect(result).toEqual({ url: 'https://example.com/test.jpg' });
    });
  });
});
