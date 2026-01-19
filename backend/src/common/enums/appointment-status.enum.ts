/**
 * Appointment lifecycle statuses
 * SCHEDULED: Appointment created and awaiting service
 * ATTENDED: Service was completed
 * CANCELED: Appointment was canceled (by client or barbershop)
 * NO_SHOW: Client did not show up for the appointment
 */
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  ATTENDED = 'ATTENDED',
  CANCELED = 'CANCELED',
  NO_SHOW = 'NO_SHOW',
}
