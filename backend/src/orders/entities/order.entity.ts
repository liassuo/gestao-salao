export class Order {
  id: string;
  status: string;
  totalAmount: number;
  notes?: string;
  clientId?: string;
  professionalId?: string;
  branchId?: string;
  paymentId?: string;
  appointmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}
