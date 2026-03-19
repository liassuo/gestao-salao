export interface WorkingHours {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

export interface Professional {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  commissionRate?: number | null; // percentual (ex: 50.00 = 50%)
  workingHours?: WorkingHours[] | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  services?: {
    id: string;
    name: string;
  }[];
}

export interface CreateProfessionalPayload {
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  commissionRate?: number;
  workingHours?: WorkingHours[];
  serviceIds?: string[];
}

export interface UpdateProfessionalPayload {
  name?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  commissionRate?: number;
  workingHours?: WorkingHours[];
  isActive?: boolean;
  serviceIds?: string[];
}

// Labels para dias da semana
export const weekDayLabels: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export const weekDayShortLabels: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};
