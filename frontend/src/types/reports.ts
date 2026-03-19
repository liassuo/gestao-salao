export interface SalesReport {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
  };
  byMethod: {
    method: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  daily: {
    date: string;
    amount: number;
  }[];
  transactions: {
    id: string;
    date: string;
    amount: number;
    method: string;
    clientName: string;
    professionalName: string;
    services: string;
  }[];
}

export interface ProfessionalReport {
  id: string;
  name: string;
  commissionRate: number;
  stats: {
    total: number;
    attended: number;
    canceled: number;
    noShow: number;
    scheduled: number;
    attendanceRate: number;
  };
  financial: {
    totalRevenue: number;
    commission: number;
    averageTicket: number;
  };
}

export interface ServicesReport {
  id: string;
  name: string;
  price: number;
  duration: number;
  count: number;
  revenue: number;
  percentage: number;
  hadPromotion?: boolean;
}

export interface ClientsReport {
  summary: {
    newClients: number;
    activeClients: number;
    clientsWithDebts: number;
    totalDebt: number;
  };
  topClients: {
    id: string;
    name: string;
    phone: string;
    appointmentsCount: number;
    totalSpent: number;
  }[];
  debtors: {
    id: string;
    name: string;
    phone: string;
    totalDebt: number;
    debtsCount: number;
  }[];
}

export interface DebtsReport {
  summary: {
    debtsCreatedCount: number;
    totalCreated: number;
    debtsPaidCount: number;
    totalPaid: number;
    currentDebtsCount: number;
    totalOutstanding: number;
  };
  created: {
    id: string;
    clientName: string;
    clientPhone: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }[];
  outstanding: {
    id: string;
    clientName: string;
    clientPhone: string;
    amount: number;
    amountPaid: number;
    remainingBalance: number;
    dueDate: string | null;
    createdAt: string;
    daysPending: number;
  }[];
}

export interface CashRegisterReport {
  summary: {
    totalCash: number;
    totalPix: number;
    totalCard: number;
    totalRevenue: number;
    totalDiscrepancy: number;
    daysCount: number;
    averageDaily: number;
  };
  registers: {
    id: string;
    date: string;
    openedBy: string;
    closedBy: string | null;
    isOpen: boolean;
    openingBalance: number;
    closingBalance: number | null;
    totalCash: number | null;
    totalPix: number | null;
    totalCard: number | null;
    totalRevenue: number | null;
    discrepancy: number | null;
    transactionsCount: number;
  }[];
}
