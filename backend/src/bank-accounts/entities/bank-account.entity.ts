/**
 * BankAccount domain entity
 * Represents bank accounts used for financial transactions
 * Examples: Conta Corrente, Conta Poupanca, Caixa do Salao, etc.
 */
export class BankAccount {
  id: string;
  name: string;

  /**
   * Bank name (optional)
   * Example: Banco do Brasil, Nubank, Inter
   */
  bank?: string;

  /**
   * Account type (optional)
   * Example: Conta Corrente, Conta Poupanca, Caixa
   */
  accountType?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
