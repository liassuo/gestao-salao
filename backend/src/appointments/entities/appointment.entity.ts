import { AppointmentStatus } from '@common/enums';

/**
 * Appointment domain entity
 * Represents a scheduled service session
 *
 * IMPORTANT: Appointment (service) is SEPARATE from Payment
 * - An appointment can be ATTENDED but NOT PAID
 * - Payment is registered separately and may happen before, during, or after service
 */
export class Appointment {
  id: string;

  /**
   * Client who booked the appointment
   */
  clientId: string;

  /**
   * Professional who will provide the service
   */
  professionalId: string;

  /**
   * List of services to be performed
   */
  serviceIds: string[];

  /**
   * Scheduled date and time
   */
  scheduledAt: Date;

  /**
   * Appointment lifecycle status
   */
  status: AppointmentStatus;

  /**
   * Total price calculated from services
   * Stored in cents
   */
  totalPrice: number;

  /**
   * Total duration calculated from services
   * Stored in minutes
   */
  totalDuration: number;

  /**
   * Flag to track if this appointment has been paid
   * CRITICAL: This is independent of the status
   * An appointment can be ATTENDED but isPaid = false
   */
  isPaid: boolean;

  /**
   * Reference to payment if it exists
   */
  paymentId?: string;

  /**
   * Additional notes or special requests
   */
  notes?: string;

  createdAt: Date;
  updatedAt: Date;

  /**
   * Timestamps for status changes
   */
  attendedAt?: Date;
  canceledAt?: Date;
}
