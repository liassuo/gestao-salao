import { TransactionType } from '@common/enums';

/**
 * FinancialCategory domain entity
 * Represents a category for financial transactions (expenses or revenues)
 *
 * Supports hierarchy:
 * - A category can have a parent (parentId)
 * - A category can have multiple children
 *
 * Examples:
 * - EXPENSE > Salarios
 * - EXPENSE > Produtos > Shampoo
 * - REVENUE > Servicos > Corte
 */
export class FinancialCategory {
  id: string;

  /**
   * Category name
   */
  name: string;

  /**
   * Type of transaction: EXPENSE or REVENUE
   */
  type: TransactionType;

  /**
   * Whether the category is active
   */
  isActive: boolean;

  /**
   * Optional parent category for hierarchy
   */
  parentId?: string;

  createdAt: Date;
  updatedAt: Date;
}
