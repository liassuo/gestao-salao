import { useState } from 'react';
import { X, CreditCard, User, Mail, Hash, MapPin, Phone, Check } from 'lucide-react';

interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone: string;
  mobilePhone?: string;
}

interface CreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { creditCard: CreditCardData; creditCardHolderInfo: CreditCardHolderInfo }) => void;
  isSubmitting?: boolean;
  amount: number;
}

export function CreditCardModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  amount,
}: CreditCardModalProps) {
  const [step, setStep] = useState(1);
  const [cardData, setCardData] = useState<CreditCardData>({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
  });

  const [holderInfo, setHolderInfo] = useState<CreditCardHolderInfo>({
    name: '',
    email: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    phone: '',
  });

  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ creditCard: cardData, creditCardHolderInfo: holderInfo });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#C8923A]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {step === 1 ? 'Dados do Cartão' : 'Dados do Titular'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={step === 1 ? handleNextStep : handleFinalSubmit}>
          {/* Content */}
          <div className="p-6 md:max-h-[70vh] overflow-y-auto">
            <div className="mb-6 flex justify-between items-center bg-[var(--hover-bg)] p-3 rounded-xl border border-[var(--border-color)]">
              <span className="text-sm text-[var(--text-secondary)]">Valor Mensal:</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(amount)}</span>
            </div>

            {step === 1 ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Nome no Cartão</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      required
                      type="text"
                      placeholder="Como impresso no cartão"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                      value={cardData.holderName}
                      onChange={(e) => setCardData({ ...cardData, holderName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Número do Cartão</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      required
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                      value={cardData.number}
                      onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, '') })}
                      maxLength={16}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Mês (MM)</label>
                    <input
                      required
                      type="text"
                      placeholder="MM"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none text-center"
                      value={cardData.expiryMonth}
                      onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, '') })}
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Ano (AAAA)</label>
                    <input
                      required
                      type="text"
                      placeholder="AAAA"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none text-center"
                      value={cardData.expiryYear}
                      onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, '') })}
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">CVV</label>
                    <input
                      required
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none text-center"
                      value={cardData.ccv}
                      onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, '') })}
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      required
                      type="text"
                      placeholder="Nome do titular do cartão"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                      value={holderInfo.name}
                      onChange={(e) => setHolderInfo({ ...holderInfo, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">CPF / CNPJ</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                      <input
                        required
                        type="text"
                        placeholder="Apenas números"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                        value={holderInfo.cpfCnpj}
                        onChange={(e) => setHolderInfo({ ...holderInfo, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">CEP</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                      <input
                        required
                        type="text"
                        placeholder="00000-000"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                        value={holderInfo.postalCode}
                        onChange={(e) => setHolderInfo({ ...holderInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                      <input
                        required
                        type="email"
                        placeholder="email@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                        value={holderInfo.email}
                        onChange={(e) => setHolderInfo({ ...holderInfo, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Nº</label>
                    <input
                      required
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                      value={holderInfo.addressNumber}
                      onChange={(e) => setHolderInfo({ ...holderInfo, addressNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      required
                      type="tel"
                      placeholder="(00) 00000-0000"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-[#C8923A] focus:ring-1 focus:ring-[#C8923A] outline-none"
                      value={holderInfo.phone}
                      onChange={(e) => setHolderInfo({ ...holderInfo, phone: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[var(--hover-bg)] px-6 py-4 flex gap-3 border-t border-[var(--border-color)]">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-[var(--border-color)] py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-all disabled:opacity-50"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] rounded-xl bg-[#8B6914] py-3 text-sm font-bold text-white shadow-lg shadow-[#8B6914]/20 hover:bg-[#725510] hover:shadow-[#8B6914]/40 transition-all active:transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : step === 1 ? (
                'Próximo Passo'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Finalizar Assinatura
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
