import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService, ReportFilters } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private parseFilters(
    startDate?: string,
    endDate?: string,
    professionalId?: string,
  ): ReportFilters {
    if (!startDate || !endDate) {
      // Default: current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      return {
        startDate: `${year}-${month}-01T00:00:00`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59`,
        professionalId,
      };
    }

    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new BadRequestException('Datas inválidas. Use o formato YYYY-MM-DD');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Data inicial deve ser anterior à data final');
    }

    return {
      startDate: `${startDate}T00:00:00`,
      endDate: `${endDate}T23:59:59`,
      professionalId,
    };
  }

  /**
   * GET /reports/sales
   * Returns sales report for a period
   */
  @Get('sales')
  async getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate, professionalId);
    return this.reportsService.getSalesReport(filters);
  }

  /**
   * GET /reports/professionals
   * Returns professional performance report
   */
  @Get('professionals')
  async getProfessionalReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate, professionalId);
    return this.reportsService.getProfessionalReport(filters);
  }

  /**
   * GET /reports/services
   * Returns services popularity report
   */
  @Get('services')
  async getServicesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate);
    return this.reportsService.getServicesReport(filters);
  }

  /**
   * GET /reports/clients
   * Returns clients report
   */
  @Get('clients')
  async getClientsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate);
    return this.reportsService.getClientsReport(filters);
  }

  /**
   * GET /reports/debts
   * Returns debts report
   */
  @Get('debts')
  async getDebtsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate);
    return this.reportsService.getDebtsReport(filters);
  }

  /**
   * GET /reports/cash-register
   * Returns cash register report
   */
  @Get('cash-register')
  async getCashRegisterReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = this.parseFilters(startDate, endDate);
    return this.reportsService.getCashRegisterReport(filters);
  }
}
