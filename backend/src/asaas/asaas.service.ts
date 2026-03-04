import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AsaasCustomer,
  AsaasCreateCustomerPayload,
  AsaasCharge,
  AsaasCreateChargePayload,
  AsaasPixQrCode,
  AsaasSubscription,
  AsaasCreateSubscriptionPayload,
  AsaasApiError,
} from './asaas.types';

@Injectable()
export class AsaasService implements OnModuleInit {
  private readonly logger = new Logger(AsaasService.name);
  private httpClient: AxiosInstance;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('ASAAS_API_KEY');
    const environment = this.configService.get<string>('ASAAS_ENVIRONMENT', 'sandbox');

    if (!apiKey || apiKey === 'your-asaas-api-key') {
      this.logger.warn(
        'ASAAS_API_KEY não configurada. Integração Asaas desabilitada.',
      );
      return;
    }

    const baseURL =
      environment === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';

    this.httpClient = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
      },
      timeout: 30000,
    });

    this.isConfigured = true;
    this.logger.log(`Asaas configurado (${environment}): ${baseURL}`);
  }

  /**
   * Verifica se o serviço Asaas está configurado e pronto para uso.
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async createCustomer(
    payload: AsaasCreateCustomerPayload,
  ): Promise<AsaasCustomer> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.post<AsaasCustomer>(
        '/customers',
        payload,
      );
      this.logger.log(`Cliente Asaas criado: ${data.id} (${data.name})`);
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao criar cliente no Asaas');
    }
  }

  async updateCustomer(
    asaasCustomerId: string,
    payload: Partial<AsaasCreateCustomerPayload>,
  ): Promise<AsaasCustomer> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.put<AsaasCustomer>(
        `/customers/${asaasCustomerId}`,
        payload,
      );
      this.logger.log(`Cliente Asaas atualizado: ${data.id}`);
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao atualizar cliente no Asaas');
    }
  }

  async findCustomerByExternalReference(
    externalReference: string,
  ): Promise<AsaasCustomer | null> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.get('/customers', {
        params: { externalReference },
      });
      return data.data?.[0] || null;
    } catch (error) {
      this.handleApiError(
        error,
        'Erro ao buscar cliente no Asaas por referência externa',
      );
    }
  }

  // ============================================
  // CHARGES (COBRANÇAS)
  // ============================================

  async createCharge(
    payload: AsaasCreateChargePayload,
  ): Promise<AsaasCharge> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.post<AsaasCharge>(
        '/payments',
        payload,
      );
      this.logger.log(
        `Cobrança Asaas criada: ${data.id} (${data.billingType} - R$ ${data.value})`,
      );
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao criar cobrança no Asaas');
    }
  }

  async getCharge(asaasPaymentId: string): Promise<AsaasCharge> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.get<AsaasCharge>(
        `/payments/${asaasPaymentId}`,
      );
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao consultar cobrança no Asaas');
    }
  }

  async cancelCharge(asaasPaymentId: string): Promise<AsaasCharge> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.delete<AsaasCharge>(
        `/payments/${asaasPaymentId}`,
      );
      this.logger.log(`Cobrança Asaas cancelada: ${asaasPaymentId}`);
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao cancelar cobrança no Asaas');
    }
  }

  async getPixQrCode(asaasPaymentId: string): Promise<AsaasPixQrCode> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.get<AsaasPixQrCode>(
        `/payments/${asaasPaymentId}/pixQrCode`,
      );
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao obter QR Code PIX');
    }
  }

  // ============================================
  // SUBSCRIPTIONS (ASSINATURAS RECORRENTES)
  // ============================================

  async createSubscription(
    payload: AsaasCreateSubscriptionPayload,
  ): Promise<AsaasSubscription> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.post<AsaasSubscription>(
        '/subscriptions',
        payload,
      );
      this.logger.log(
        `Assinatura Asaas criada: ${data.id} (${data.cycle} - R$ ${data.value})`,
      );
      return data;
    } catch (error) {
      this.handleApiError(error, 'Erro ao criar assinatura no Asaas');
    }
  }

  async cancelSubscription(
    asaasSubscriptionId: string,
  ): Promise<AsaasSubscription> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.delete<AsaasSubscription>(
        `/subscriptions/${asaasSubscriptionId}`,
      );
      this.logger.log(
        `Assinatura Asaas cancelada: ${asaasSubscriptionId}`,
      );
      return data;
    } catch (error) {
      this.handleApiError(
        error,
        'Erro ao cancelar assinatura no Asaas',
      );
    }
  }

  async getSubscription(
    asaasSubscriptionId: string,
  ): Promise<AsaasSubscription> {
    this.ensureConfigured();
    try {
      const { data } = await this.httpClient.get<AsaasSubscription>(
        `/subscriptions/${asaasSubscriptionId}`,
      );
      return data;
    } catch (error) {
      this.handleApiError(
        error,
        'Erro ao consultar assinatura no Asaas',
      );
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Converte valor de centavos (sistema) para reais (Asaas API).
   * Ex: 5000 centavos → 50.00 reais
   */
  centavosToReais(centavos: number): number {
    return Number((centavos / 100).toFixed(2));
  }

  /**
   * Converte valor de reais (Asaas API) para centavos (sistema).
   * Ex: 50.00 reais → 5000 centavos
   */
  reaisToCentavos(reais: number): number {
    return Math.round(reais * 100);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Asaas não está configurado. Verifique a variável ASAAS_API_KEY.',
      );
    }
  }

  private handleApiError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<AsaasApiError>;
      const asaasErrors = axiosError.response?.data?.errors;
      const statusCode = axiosError.response?.status;

      if (asaasErrors?.length) {
        const errorMessages = asaasErrors
          .map((e) => `[${e.code}] ${e.description}`)
          .join('; ');
        this.logger.error(`${context}: ${errorMessages} (HTTP ${statusCode})`);
        throw new Error(`${context}: ${errorMessages}`);
      }

      this.logger.error(
        `${context}: HTTP ${statusCode} - ${axiosError.message}`,
      );
      throw new Error(`${context}: ${axiosError.message}`);
    }

    this.logger.error(`${context}: ${error}`);
    throw error;
  }
}
