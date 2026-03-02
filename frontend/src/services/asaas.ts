import { api } from './api';
import type {
  AsaasCharge,
  AsaasPixQrCode,
  AsaasChargeResponse,
  CreateChargePayload,
} from '@/types';

export const asaasService = {
  /**
   * Criar cobrança no Asaas (PIX, Boleto ou Cartão)
   */
  async createCharge(payload: CreateChargePayload): Promise<AsaasChargeResponse> {
    const response = await api.post<AsaasChargeResponse>('/asaas/charges', payload);
    return response.data;
  },

  /**
   * Consultar cobrança no Asaas
   */
  async getCharge(asaasPaymentId: string): Promise<AsaasCharge> {
    const response = await api.get<AsaasCharge>(`/asaas/charges/${asaasPaymentId}`);
    return response.data;
  },

  /**
   * Obter QR Code PIX da cobrança
   */
  async getPixQrCode(asaasPaymentId: string): Promise<AsaasPixQrCode> {
    const response = await api.get<AsaasPixQrCode>(
      `/asaas/charges/${asaasPaymentId}/pix-qrcode`,
    );
    return response.data;
  },

  /**
   * Cancelar cobrança no Asaas
   */
  async cancelCharge(asaasPaymentId: string): Promise<AsaasCharge> {
    const response = await api.delete<AsaasCharge>(`/asaas/charges/${asaasPaymentId}`);
    return response.data;
  },

  /**
   * Sincronizar cliente com Asaas
   */
  async syncCustomer(clientId: string): Promise<any> {
    const response = await api.post(`/asaas/sync-customer/${clientId}`);
    return response.data;
  },
};
