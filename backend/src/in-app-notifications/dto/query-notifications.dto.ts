import { IsOptional, IsNumberString, IsIn, IsString } from 'class-validator';

export class QueryNotificationsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsIn(['all', 'unread', 'read'])
  filter?: 'all' | 'unread' | 'read';

  @IsOptional()
  @IsString()
  type?: string;
}
