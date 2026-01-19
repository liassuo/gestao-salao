/**
 * DTO for creating a new professional
 */
export class CreateProfessionalDto {
  name: string;
  phone: string;
  email?: string;
  serviceIds?: string[];
  workingHours?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  commissionRate?: number;
}
