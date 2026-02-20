import {
  IsEnum,
  IsString,
  IsInt,
  IsPositive,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
} from 'class-validator';
import {
  TransactionType,
  PaymentCondition,
  TransactionStatus,
} from '../../common/enums';

export class UpdateFinancialTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType, { message: 'Tipo deve ser EXPENSE ou REVENUE' })
  type?: TransactionType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Valor deve ser um numero inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Desconto deve ser um numero' })
  discount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Juros deve ser um numero' })
  interest?: number;

  @IsOptional()
  @IsEnum(PaymentCondition, { message: 'Condicao de pagamento deve ser A_VISTA ou A_PRAZO' })
  paymentCondition?: PaymentCondition;

  @IsOptional()
  @IsEnum(TransactionStatus, { message: 'Status deve ser PENDING, PAID, OVERDUE ou CANCELED' })
  status?: TransactionStatus;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'branchId deve ser um UUID valido' })
  branchId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId deve ser um UUID valido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'subcategoryId deve ser um UUID valido' })
  subcategoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'bankAccountId deve ser um UUID valido' })
  bankAccountId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'paymentMethodConfigId deve ser um UUID valido' })
  paymentMethodConfigId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
