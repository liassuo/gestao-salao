-- Cartão tokenizado do cliente (Asaas) para débito direto sem reabrir link.
-- O Asaas devolve o creditCardToken na criação de uma cobrança/assinatura paga no
-- cartão ONLINE (não em maquininha). Guardamos o último token + 4 dígitos/bandeira
-- p/ a ação "Cobrar no cartão" do ciclo vigente debitar na hora. Tudo NULL por
-- padrão: sem token, o fluxo cai no link (comportamento atual), sem regressão.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS "asaasCreditCardToken" text,
  ADD COLUMN IF NOT EXISTS "asaasCreditCardLast4" text,
  ADD COLUMN IF NOT EXISTS "asaasCreditCardBrand" text;
