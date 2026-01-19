/**
 * DTO for updating professional information
 * All fields are optional
 */
export class UpdateProfessionalDto {
  name?: string;
  phone?: string;
  email?: string;
  serviceIds?: string[];
  workingHours?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  commissionRate?: number;
  isActive?: boolean;
}
