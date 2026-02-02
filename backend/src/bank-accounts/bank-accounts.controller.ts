import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto';

@ApiTags('BankAccounts')
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  /**
   * GET /bank-accounts
   * Returns all bank accounts
   */
  @Get()
  async findAll() {
    return this.bankAccountsService.findAll();
  }

  /**
   * GET /bank-accounts/active
   * Returns only active bank accounts
   */
  @Get('active')
  async findActive() {
    return this.bankAccountsService.findActive();
  }

  /**
   * GET /bank-accounts/:id
   * Returns a specific bank account
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bankAccountsService.findOne(id);
  }

  /**
   * POST /bank-accounts
   * Creates a new bank account
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(dto);
  }

  /**
   * PATCH /bank-accounts/:id
   * Updates a bank account
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(id, dto);
  }

  /**
   * DELETE /bank-accounts/:id
   * Soft deletes a bank account
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.bankAccountsService.remove(id);
  }
}
