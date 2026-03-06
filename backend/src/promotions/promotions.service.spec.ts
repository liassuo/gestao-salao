import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePromotionDto } from './dto';

// ─── helpers ────────────────────────────────────────────────────────────────

let chains: Record<string, any> = {};

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

const mockStorageBucket = {
  upload: jest.fn().mockResolvedValue({ data: { path: 'banner.jpg' }, error: null }),
  getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/banner.jpg' } }),
  remove: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabase = {
  from: jest.fn().mockImplementation((table: string) => {
    if (!chains[table]) chains[table] = mockChain();
    return chains[table];
  }),
  client: {
    storage: {
      from: jest.fn().mockReturnValue(mockStorageBucket),
    },
  },
};

// ─── shared fixtures ────────────────────────────────────────────────────────

const now = new Date();
const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
const futureStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
const futureEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
const activeStart = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
const activeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
const farPast = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

const rawPromotion = (overrides: Record<string, any> = {}) => ({
  id: 'promo-1',
  name: 'Summer Sale',
  discountPercent: 20,
  startDate: activeStart,
  endDate: activeEnd,
  status: 'ACTIVE',
  bannerImageUrl: null,
  bannerTitle: null,
  bannerText: null,
  isTemplate: false,
  isActive: true,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  promotion_services: [
    { serviceId: 'svc-1', service: { id: 'svc-1', name: 'Haircut', price: 50, duration: 30 } },
  ],
  promotion_products: [
    { productId: 'prod-1', product: { id: 'prod-1', name: 'Shampoo', salePrice: 25 } },
  ],
  ...overrides,
});

const formattedPromotion = (overrides: Record<string, any> = {}) => {
  const raw = rawPromotion(overrides);
  return {
    id: raw.id,
    name: raw.name,
    discountPercent: raw.discountPercent,
    startDate: raw.startDate,
    endDate: raw.endDate,
    status: raw.status,
    bannerImageUrl: raw.bannerImageUrl,
    bannerTitle: raw.bannerTitle,
    bannerText: raw.bannerText,
    isTemplate: raw.isTemplate,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    services: [{ id: 'svc-1', name: 'Haircut', price: 50, duration: 30 }],
    products: [{ id: 'prod-1', name: 'Shampoo', salePrice: 25 }],
  };
};

// ─── test suite ─────────────────────────────────────────────────────────────

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(async () => {
    // Reset all chains so each test starts fresh
    chains = {};
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a promotion with services and products, returning formatted result', async () => {
      const dto: CreatePromotionDto = {
        name: 'Summer Sale',
        discountPercent: 20,
        startDate: activeStart,
        endDate: activeEnd,
        serviceIds: ['svc-1'],
        productIds: ['prod-1'],
      };

      // 1) insert into promotions -> .single() returns the created row
      const promotionsChain = mockChain();
      const servicesChain = mockChain();
      const productsChain = mockChain();
      chains['promotions'] = promotionsChain;
      chains['promotion_services'] = servicesChain;
      chains['promotion_products'] = productsChain;

      // insert().select().single() → returns promo with id
      promotionsChain.insert.mockReturnValue(promotionsChain);
      promotionsChain.select.mockReturnValue(promotionsChain);
      promotionsChain.single.mockResolvedValueOnce({
        data: { id: 'promo-1', name: dto.name, discountPercent: dto.discountPercent, startDate: dto.startDate, endDate: dto.endDate, status: 'ACTIVE' },
        error: null,
      });

      // syncServices: delete().eq() → resolves, insert() → resolves
      servicesChain.delete.mockReturnValue(servicesChain);
      servicesChain.eq.mockReturnValue(servicesChain);
      servicesChain.insert.mockResolvedValue({ error: null });

      // syncProducts: delete().eq() → resolves, insert() → resolves
      productsChain.delete.mockReturnValue(productsChain);
      productsChain.eq.mockReturnValue(productsChain);
      productsChain.insert.mockResolvedValue({ error: null });

      // findOne re-queries promotions chain - single() returns full raw data
      promotionsChain.single.mockResolvedValueOnce({
        data: rawPromotion(),
        error: null,
      });

      const result = await service.create(dto);

      expect(result).toEqual(formattedPromotion());
      expect(mockSupabase.from).toHaveBeenCalledWith('promotions');
      expect(mockSupabase.from).toHaveBeenCalledWith('promotion_services');
      expect(mockSupabase.from).toHaveBeenCalledWith('promotion_products');
      expect(promotionsChain.insert).toHaveBeenCalled();
      expect(servicesChain.delete).toHaveBeenCalled();
      expect(servicesChain.insert).toHaveBeenCalledWith([{ promotionId: 'promo-1', serviceId: 'svc-1' }]);
      expect(productsChain.delete).toHaveBeenCalled();
      expect(productsChain.insert).toHaveBeenCalledWith([{ promotionId: 'promo-1', productId: 'prod-1' }]);
    });

    it('should throw BadRequestException when endDate <= startDate', async () => {
      const dto: CreatePromotionDto = {
        name: 'Bad Promo',
        discountPercent: 10,
        startDate: activeEnd,
        endDate: activeStart,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when endDate equals startDate', async () => {
      const sameDate = new Date().toISOString();
      const dto: CreatePromotionDto = {
        name: 'Same dates',
        discountPercent: 10,
        startDate: sameDate,
        endDate: sameDate,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create a promotion without services or products when none are provided', async () => {
      const dto: CreatePromotionDto = {
        name: 'No Items',
        discountPercent: 15,
        startDate: activeStart,
        endDate: activeEnd,
      };

      const promotionsChain = mockChain();
      chains['promotions'] = promotionsChain;

      promotionsChain.single
        .mockResolvedValueOnce({
          data: { id: 'promo-2', name: dto.name, discountPercent: 15, status: 'ACTIVE' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: rawPromotion({ id: 'promo-2', name: 'No Items', promotion_services: [], promotion_products: [] }),
          error: null,
        });

      const result = await service.create(dto);

      expect(result.services).toEqual([]);
      expect(result.products).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('promotion_services');
      expect(mockSupabase.from).not.toHaveBeenCalledWith('promotion_products');
    });
  });

  // ─── computeStatus (tested indirectly) ────────────────────────────────────

  describe('computeStatus (indirect)', () => {
    const setupCreateChain = (statusExpected: string, isActiveFlag = true) => {
      const promotionsChain = mockChain();
      chains['promotions'] = promotionsChain;

      promotionsChain.single
        .mockResolvedValueOnce({
          data: { id: 'promo-status', status: statusExpected },
          error: null,
        })
        .mockResolvedValueOnce({
          data: rawPromotion({ id: 'promo-status', status: statusExpected }),
          error: null,
        });

      return promotionsChain;
    };

    it('should set ACTIVE when now is between startDate and endDate', async () => {
      const chain = setupCreateChain('ACTIVE');

      const dto: CreatePromotionDto = {
        name: 'Active Promo',
        discountPercent: 10,
        startDate: activeStart,
        endDate: activeEnd,
      };

      await service.create(dto);

      const insertCall = chain.insert.mock.calls[0][0];
      expect(insertCall.status).toBe('ACTIVE');
    });

    it('should set SCHEDULED when startDate is in the future', async () => {
      const chain = setupCreateChain('SCHEDULED');

      const dto: CreatePromotionDto = {
        name: 'Future Promo',
        discountPercent: 10,
        startDate: futureStart,
        endDate: futureEnd,
      };

      await service.create(dto);

      const insertCall = chain.insert.mock.calls[0][0];
      expect(insertCall.status).toBe('SCHEDULED');
    });

    it('should set EXPIRED when endDate is in the past', async () => {
      const chain = setupCreateChain('EXPIRED');

      const dto: CreatePromotionDto = {
        name: 'Old Promo',
        discountPercent: 10,
        startDate: farPast,
        endDate: pastDate,
      };

      await service.create(dto);

      const insertCall = chain.insert.mock.calls[0][0];
      expect(insertCall.status).toBe('EXPIRED');
    });

    it('should set DISABLED via update when isActive is false', async () => {
      // findOne for existing promo (called at start of update)
      const promotionsChain = mockChain();
      chains['promotions'] = promotionsChain;

      // update calls findOne first
      promotionsChain.single
        .mockResolvedValueOnce({
          data: rawPromotion({ isActive: true }),
          error: null,
        });

      // update().eq() resolves
      promotionsChain.update.mockReturnValue(promotionsChain);
      promotionsChain.eq.mockReturnValue(promotionsChain);
      // The update call itself (no .single) - we need the chain to resolve the await
      // Actually update().eq() returns the chain which is awaited and should resolve to { error: null }
      // Let's make eq return a promise-like for the update path
      const updateEqResult = { error: null };
      // After update().eq(), the code does `const { error } = await ...`
      // The chain.eq already returns chain, and chain itself is awaited as a thenable? No.
      // Looking at the code: `const { error } = await this.supabase.from('promotions').update(updateData).eq('id', id);`
      // The eq() must return something with { error }
      promotionsChain.eq.mockReturnValueOnce(promotionsChain); // for findOne .eq('id', id)
      // Reset to set up properly
      chains['promotions'] = mockChain();
      const pChain = chains['promotions'];

      // 1st call: findOne at start of update
      pChain.single.mockResolvedValueOnce({
        data: rawPromotion({ isActive: true }),
        error: null,
      });

      // 2nd call: the update().eq() returns { error: null }
      const updateResult = Promise.resolve({ error: null });
      pChain.update.mockReturnValue(pChain);
      // After update, eq is called which should be the final awaited value
      // We need a special eq that for the update path returns { error: null }
      // Since eq is called multiple times, let's track:
      // findOne: select().eq().single() - eq returns chain
      // update: update().eq() - eq should resolve to { error: null }
      // findOne again: select().eq().single() - eq returns chain
      let eqCallCount = 0;
      pChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          // This is the update().eq() call
          return Promise.resolve({ error: null });
        }
        return pChain;
      });

      // 2nd findOne at end of update
      pChain.single.mockResolvedValueOnce({
        data: rawPromotion({ isActive: false, status: 'DISABLED' }),
        error: null,
      });

      const result = await service.update('promo-1', { isActive: false });

      expect(pChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DISABLED', isActive: false }),
      );
      expect(result.status).toBe('DISABLED');
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all promotions formatted', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      // findAll does: from('promotions').select(...).order(...) and optionally .eq(...)
      // The final result is awaited directly (no .single())
      // The chain itself is awaited, so order() should return a resolved promise
      pChain.order.mockResolvedValue({
        data: [rawPromotion(), rawPromotion({ id: 'promo-2', name: 'Winter Sale' })],
        error: null,
      });

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].services).toBeDefined();
      expect(result[0].products).toBeDefined();
      expect(result[0]).not.toHaveProperty('promotion_services');
    });

    it('should filter by status', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      // When filtering: select().order().eq() - eq is called after order
      pChain.order.mockReturnValue(pChain);
      pChain.eq.mockResolvedValue({
        data: [rawPromotion({ status: 'ACTIVE' })],
        error: null,
      });

      const result = await service.findAll({ status: 'ACTIVE' });

      expect(pChain.eq).toHaveBeenCalledWith('status', 'ACTIVE');
      expect(result).toHaveLength(1);
    });

    it('should filter by isTemplate', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.order.mockReturnValue(pChain);
      pChain.eq.mockResolvedValue({
        data: [rawPromotion({ isTemplate: true })],
        error: null,
      });

      const result = await service.findAll({ isTemplate: true });

      expect(pChain.eq).toHaveBeenCalledWith('isTemplate', true);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no data', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;
      pChain.order.mockResolvedValue({ data: null, error: null });

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findActive ───────────────────────────────────────────────────────────

  describe('findActive', () => {
    it('should query active promotions within date range', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      // findActive: select().eq('isActive').eq('status').lte('startDate').gte('endDate')
      pChain.gte.mockResolvedValue({
        data: [rawPromotion()],
        error: null,
      });

      const result = await service.findActive();

      expect(pChain.eq).toHaveBeenCalledWith('isActive', true);
      expect(pChain.eq).toHaveBeenCalledWith('status', 'ACTIVE');
      expect(pChain.lte).toHaveBeenCalledWith('startDate', expect.any(String));
      expect(pChain.gte).toHaveBeenCalledWith('endDate', expect.any(String));
      expect(result).toHaveLength(1);
      expect(result[0].services).toEqual([{ id: 'svc-1', name: 'Haircut', price: 50, duration: 30 }]);
    });

    it('should return empty array when no active promotions', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.gte.mockResolvedValue({ data: [], error: null });

      const result = await service.findActive();

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a formatted promotion', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({
        data: rawPromotion(),
        error: null,
      });

      const result = await service.findOne('promo-1');

      expect(result).toEqual(formattedPromotion());
      expect(pChain.eq).toHaveBeenCalledWith('id', 'promo-1');
      expect(pChain.single).toHaveBeenCalled();
    });

    it('should throw NotFoundException when promotion not found', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when data is null without error', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw BadRequestException when endDate <= startDate', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      // findOne at start of update
      pChain.single.mockResolvedValueOnce({
        data: rawPromotion(),
        error: null,
      });

      await expect(
        service.update('promo-1', { startDate: activeEnd, endDate: activeStart }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update dates and recompute status', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      let eqCallCount = 0;
      pChain.eq.mockImplementation(() => {
        eqCallCount++;
        // Call 1: findOne -> select().eq('id', id) -> chain (for .single())
        // Call 2: update().eq('id', id) -> should resolve with { error: null }
        // Call 3: findOne again -> select().eq('id', id) -> chain (for .single())
        if (eqCallCount === 2) {
          return Promise.resolve({ error: null });
        }
        return pChain;
      });

      // 1st findOne
      pChain.single.mockResolvedValueOnce({
        data: rawPromotion(),
        error: null,
      });

      // 2nd findOne after update
      pChain.single.mockResolvedValueOnce({
        data: rawPromotion({ startDate: futureStart, endDate: futureEnd, status: 'SCHEDULED' }),
        error: null,
      });

      const result = await service.update('promo-1', {
        startDate: futureStart,
        endDate: futureEnd,
      });

      expect(pChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SCHEDULED',
          startDate: futureStart,
          endDate: futureEnd,
        }),
      );
      expect(result.status).toBe('SCHEDULED');
    });

    it('should sync services and products when provided', async () => {
      const pChain = mockChain();
      const svcChain = mockChain();
      const prodChain = mockChain();
      chains['promotions'] = pChain;
      chains['promotion_services'] = svcChain;
      chains['promotion_products'] = prodChain;

      let eqCallCount = 0;
      pChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ error: null });
        }
        return pChain;
      });

      pChain.single
        .mockResolvedValueOnce({ data: rawPromotion(), error: null })
        .mockResolvedValueOnce({ data: rawPromotion(), error: null });

      svcChain.insert.mockResolvedValue({ error: null });
      prodChain.insert.mockResolvedValue({ error: null });

      await service.update('promo-1', {
        serviceIds: ['svc-2', 'svc-3'],
        productIds: ['prod-2'],
      });

      expect(svcChain.delete).toHaveBeenCalled();
      expect(svcChain.insert).toHaveBeenCalledWith([
        { promotionId: 'promo-1', serviceId: 'svc-2' },
        { promotionId: 'promo-1', serviceId: 'svc-3' },
      ]);
      expect(prodChain.delete).toHaveBeenCalled();
      expect(prodChain.insert).toHaveBeenCalledWith([
        { promotionId: 'promo-1', productId: 'prod-2' },
      ]);
    });

    it('should toggle isActive and set DISABLED status', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      let eqCallCount = 0;
      pChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ error: null });
        }
        return pChain;
      });

      pChain.single
        .mockResolvedValueOnce({ data: rawPromotion({ isActive: true }), error: null })
        .mockResolvedValueOnce({ data: rawPromotion({ isActive: false, status: 'DISABLED' }), error: null });

      const result = await service.update('promo-1', { isActive: false });

      expect(pChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, status: 'DISABLED' }),
      );
      expect(result.isActive).toBe(false);
      expect(result.status).toBe('DISABLED');
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete by setting isActive to false', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      // First: select('id').eq().single() to confirm existence
      pChain.single.mockResolvedValueOnce({
        data: { id: 'promo-1' },
        error: null,
      });

      // Second: update({ isActive: false }).eq()
      let eqCallCount = 0;
      pChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ error: null });
        }
        return pChain;
      });

      await service.remove('promo-1');

      expect(pChain.select).toHaveBeenCalledWith('id');
      expect(pChain.update).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw NotFoundException when promotion does not exist', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when data is null', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({ data: null, error: null });

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadBanner ─────────────────────────────────────────────────────────

  describe('uploadBanner', () => {
    it('should upload file to storage and return public URL', async () => {
      const file = {
        originalname: 'my banner.png',
        buffer: Buffer.from('fake'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      const result = await service.uploadBanner(file);

      expect(mockSupabase.client.storage.from).toHaveBeenCalledWith('promotion-banners');
      expect(mockStorageBucket.upload).toHaveBeenCalledWith(
        expect.stringContaining('my-banner.png'),
        file.buffer,
        { contentType: 'image/png', upsert: false },
      );
      expect(mockStorageBucket.getPublicUrl).toHaveBeenCalledWith('banner.jpg');
      expect(result).toEqual({ url: 'https://example.com/banner.jpg' });
    });

    it('should throw when upload fails', async () => {
      mockStorageBucket.upload.mockResolvedValueOnce({
        data: null,
        error: new Error('Upload failed'),
      });

      const file = {
        originalname: 'fail.png',
        buffer: Buffer.from('data'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(service.uploadBanner(file)).rejects.toThrow('Upload failed');
    });
  });

  // ─── deleteBanner ─────────────────────────────────────────────────────────

  describe('deleteBanner', () => {
    it('should extract path and remove from storage', async () => {
      await service.deleteBanner('https://example.com/storage/v1/object/public/promotion-banners/12345-banner.jpg');

      expect(mockSupabase.client.storage.from).toHaveBeenCalledWith('promotion-banners');
      expect(mockStorageBucket.remove).toHaveBeenCalledWith(['12345-banner.jpg']);
    });

    it('should do nothing when URL has no valid path', async () => {
      mockStorageBucket.remove.mockClear();

      await service.deleteBanner('https://example.com/no-match');

      expect(mockStorageBucket.remove).not.toHaveBeenCalled();
    });
  });

  // ─── formatPromotion ──────────────────────────────────────────────────────

  describe('formatPromotion (via findOne)', () => {
    it('should map promotion_services and promotion_products correctly', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({
        data: rawPromotion({
          promotion_services: [
            { serviceId: 'svc-1', service: { id: 'svc-1', name: 'Haircut', price: 50, duration: 30 } },
            { serviceId: 'svc-2', service: { id: 'svc-2', name: 'Beard', price: 30, duration: 15 } },
          ],
          promotion_products: [
            { productId: 'prod-1', product: { id: 'prod-1', name: 'Shampoo', salePrice: 25 } },
          ],
        }),
        error: null,
      });

      const result = await service.findOne('promo-1');

      expect(result.services).toEqual([
        { id: 'svc-1', name: 'Haircut', price: 50, duration: 30 },
        { id: 'svc-2', name: 'Beard', price: 30, duration: 15 },
      ]);
      expect(result.products).toEqual([
        { id: 'prod-1', name: 'Shampoo', salePrice: 25 },
      ]);
      expect(result).not.toHaveProperty('promotion_services');
      expect(result).not.toHaveProperty('promotion_products');
    });

    it('should handle missing service/product relations gracefully', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({
        data: rawPromotion({
          promotion_services: [{ serviceId: 'svc-1', service: null }],
          promotion_products: [],
        }),
        error: null,
      });

      const result = await service.findOne('promo-1');

      expect(result.services).toEqual([
        { id: 'svc-1', name: undefined, price: undefined, duration: undefined },
      ]);
      expect(result.products).toEqual([]);
    });

    it('should handle empty promotion_services and promotion_products', async () => {
      const pChain = mockChain();
      chains['promotions'] = pChain;

      pChain.single.mockResolvedValue({
        data: rawPromotion({ promotion_services: [], promotion_products: [] }),
        error: null,
      });

      const result = await service.findOne('promo-1');

      expect(result.services).toEqual([]);
      expect(result.products).toEqual([]);
    });
  });
});
