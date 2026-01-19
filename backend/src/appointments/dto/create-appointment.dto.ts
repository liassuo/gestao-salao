/**
 * DTO for creating a new appointment
 */
export class CreateAppointmentDto {
  clientId: string;
  professionalId: string;
  serviceIds: string[];
  scheduledAt: Date;
  notes?: string;
}
