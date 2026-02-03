import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/stats
   * Returns main dashboard statistics
   */
  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  /**
   * GET /dashboard/today-appointments
   * Returns today's appointments
   */
  @Get('today-appointments')
  async getTodayAppointments() {
    return this.dashboardService.getTodayAppointments();
  }

  /**
   * GET /dashboard/upcoming-appointments
   * Returns upcoming appointments
   */
  @Get('upcoming-appointments')
  async getUpcomingAppointments(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getUpcomingAppointments(limitNum);
  }

  /**
   * GET /dashboard/recent-activity
   * Returns recent activity (payments, appointments, debts)
   */
  @Get('recent-activity')
  async getRecentActivity(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentActivity(limitNum);
  }

  /**
   * GET /dashboard/revenue-by-method
   * Returns revenue grouped by payment method
   */
  @Get('revenue-by-method')
  async getRevenueByMethod(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.dashboardService.getRevenueByMethod(start, end);
  }

  /**
   * GET /dashboard/professional-performance
   * Returns professional performance metrics
   */
  @Get('professional-performance')
  async getProfessionalPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.dashboardService.getProfessionalPerformance(start, end);
  }

  /**
   * GET /dashboard/daily-revenue
   * Returns daily revenue for charts
   */
  @Get('daily-revenue')
  async getDailyRevenue(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getDailyRevenue(daysNum);
  }

  /**
   * GET /dashboard/services-popularity
   * Returns most popular services
   */
  @Get('services-popularity')
  async getServicesPopularity(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getServicesPopularity(limitNum);
  }

  /**
   * GET /dashboard/operational
   * Returns operational dashboard data (professionals, orders, top clients, stock, unpaid)
   */
  @Get('operational')
  async getOperationalData() {
    return this.dashboardService.getOperationalData();
  }

  /**
   * GET /dashboard/strategic
   * Returns strategic dashboard data (subscriptions, revenue, history, occupancy)
   */
  @Get('strategic')
  async getStrategicData() {
    return this.dashboardService.getStrategicData();
  }
}
