import { AppointmentStatus } from '@common/enums';

/**
 * DTO for updating appointment information
 * All fields are optional
 */
export class UpdateAppointmentDto {
  professionalId?: string;
  serviceIds?: string[];
  scheduledAt?: Date;
  status?: AppointmentStatus;
  notes?: string;
}
