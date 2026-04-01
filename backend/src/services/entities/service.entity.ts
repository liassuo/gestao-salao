/**
 * Service domain entity
 * Represents services offered by the barbershop
 * Examples: Haircut, Beard trim, Hair wash, etc.
 */
export class Service {
  id: string;
  name: string;
  description?: string;

  /**
   * Service price in cents (to avoid floating point issues)
   * Example: R$ 50,00 = 5000
   */
  price: number;

  /**
   * Estimated duration in minutes
   * Used for scheduling and calculating availability
   */
  duration: number;

  /**
   * Fichas (tokens) for subscription commission calculation
   * If 0, defaults to duration (minutes) as fallback
   */
  fichas: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
