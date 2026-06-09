import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { SupabaseService } from '../supabase/supabase.service';

// Mock the payments helper so we can assert exactly how the month-revenue window
// is bounded (the real query goes to PostgREST; the unit under test is the window).
jest.mock('../common/business-date.helper', () => {
  const actual = jest.requireActual('../common/business-date.helper');
  return {
    ...actual,
    fetchPaymentsByBusinessDate: jest.fn().mockResolvedValue([]),
  };
});
import { fetchPaymentsByBusinessDate } from '../common/business-date.helper';

// Thenable chain resolving to a neutral { count, data } so the parallel queries resolve.
const makeChain = () => {
  const chain: any = { __result: { data: [], error: null, count: 0 } };
  for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'is', 'not', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn(() => Promise.resolve(chain.__result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(chain.__result));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(chain.__result).then(resolve, reject);
  return chain;
};
const mockSupabase = { from: jest.fn(() => makeChain()) };

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    (fetchPaymentsByBusinessDate as jest.Mock).mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  describe('getStats (M1)', () => {
    it('bounds the month-revenue window to the END of the current month (no future prepayments)', async () => {
      await service.getStats();

      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthStart = `${now.getFullYear()}-${mm}-01T00:00:00`;
      const monthEnd = `${now.getFullYear()}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59`;

      const calls = (fetchPaymentsByBusinessDate as jest.Mock).mock.calls;
      // The month-revenue call must pass BOTH start (1st) and end (last day) — i.e. a
      // closed window. Before the fix it passed only the start (open window → future
      // businessDate prepayments leaked into the current month).
      const monthCall = calls.find((c) => c[2] === monthStart && c[3] === monthEnd);
      expect(monthCall).toBeDefined();
    });
  });
});
