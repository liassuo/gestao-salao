export interface DashboardStats {
  todayAppointments: number;
  pendingAppointments: number;
  todayRevenue: number;
  monthRevenue: number;
  revenueChange: number;
  totalClients: number;
  activeClients: number;
  clientsWithDebts: number;
  totalDebts: number;
  totalProfessionals: number;
}

export interface TodayAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  totalPrice: number;
  isPaid: boolean;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  professional: {
    id: string;
    name: string;
  };
  services: {
    service: {
      name: string;
    };
  }[];
}

export interface UpcomingAppointment {
  id: string;
  scheduledAt: string;
  totalPrice: number;
  client: {
    name: string;
  };
  professional: {
    name: string;
  };
  services: {
    service: {
      name: string;
    };
  }[];
}

export interface RecentActivity {
  type: 'payment' | 'appointment' | 'debt';
  id: string;
  description: string;
  amount?: number;
  method?: string;
  status?: string;
  date: string;
}

export interface RevenueByMethod {
  method: string;
  total: number;
  count: number;
}

export interface ProfessionalPerformance {
  id: string;
  name: string;
  appointmentsCount: number;
  totalRevenue: number;
  commissionRate: number | null;
}

export interface DailyRevenue {
  date: string;
  amount: number;
}

export interface ServicePopularity {
  id: string;
  name: string;
  price: number;
  count: number;
}

export interface BirthdayClient {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  day: number;
}

export interface OperationalData {
  activeProfessionals: number;
  openOrders: number;
  totalClients: number;
  topClients: TopClient[];
  birthdayClients: BirthdayClient[];
  unpaidClients: UnpaidClient[];
}

export interface TopClient {
  id: string;
  name: string;
  totalServices: number;
  totalProducts: number;
  totalSubscription: number;
  total: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
}

export interface UnpaidClient {
  id: string;
  name: string;
  phone: string;
  unpaidAmount: number;
  unpaidCount: number;
}

export interface StrategicData {
  plans: {
    activePlans: number;
    soldThisMonth: number;
    canceledThisMonth: number;
  };
  revenue: {
    monthlyRevenue: number;
    yearlyRevenue: number;
  };
  monthlyRevenueHistory: MonthlyRevenue[];
  professionalOccupancy: ProfessionalOccupancy[];
}

export interface MonthlyRevenue {
  month: string;
  amount: number;
}

export interface ProfessionalOccupancy {
  id: string;
  name: string;
  totalAppointments: number;
  attendedAppointments: number;
  occupancyRate: number;
}
