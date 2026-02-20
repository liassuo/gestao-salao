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

export class CreateFinancialTransactionDto {
  @IsEnum(TransactionType, { message: 'Tipo deve ser EXPENSE ou REVENUE' })
  type: TransactionType;

  @IsString({ message: 'Descricao e obrigatoria' })
  description: string;

  @IsInt({ message: 'Valor deve ser um numero inteiro (centavos)' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @IsOptional()
  @IsNumber({}, { message: 'Desconto deve ser um numero' })
  discount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Juros deve ser um numero' })
  interest?: number;

  @IsEnum(PaymentCondition, { message: 'Condicao de pagamento deve ser A_VISTA ou A_PRAZO' })
  paymentCondition: PaymentCondition;

  @IsOptional()
  @IsBoolean({ message: 'isRecurring deve ser booleano' })
  isRecurring?: boolean;

  @IsDateString({}, { message: 'Data de vencimento deve ser uma data valida' })
  dueDate: string;

  @IsOptional()
  @IsUUID('4', { message: 'branchId deve ser um UUID valido' })
  branchId?: string;

  @IsUUID('4', { message: 'categoryId deve ser um UUID valido' })
  categoryId: string;

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
  @IsEnum(TransactionStatus, { message: 'Status deve ser PENDING, PAID, OVERDUE ou CANCELED' })
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
