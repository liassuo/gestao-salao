export interface CalendarProfessional {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  workingHours: { dayOfWeek: number; startTime: string; endTime: string }[] | null;
  appointments: CalendarAppointment[];
  timeBlocks: CalendarTimeBlock[];
}

export interface CalendarAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  totalPrice: number;
  totalDuration: number;
  isPaid: boolean;
  notes: string | null;
  client: { id: string; name: string; phone: string };
  services: { service: { name: string } }[];
}

export interface CalendarTimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface CreateTimeBlockPayload {
  professionalId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}
