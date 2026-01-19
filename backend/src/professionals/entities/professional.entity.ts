/**
 * Professional domain entity
 * Represents barbers who provide services
 * May or may not have a linked User account for admin panel access
 */
export class Professional {
  id: string;
  name: string;
  phone: string;
  email?: string;

  /**
   * Services this professional can perform
   * Reference to Service IDs
   */
  serviceIds: string[];

  /**
   * Working hours configuration
   * Can be stored as JSON or separate table
   */
  workingHours?: {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // HH:mm format
    endTime: string;
  }[];

  /**
   * Commission percentage for services performed
   */
  commissionRate?: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
