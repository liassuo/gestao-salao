-- Tabela de Promocoes
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "discountPercent" INTEGER NOT NULL,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  "bannerImageUrl" TEXT,
  "bannerTitle" TEXT,
  "bannerText" TEXT,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relacao Promocao <-> Servico
CREATE TABLE IF NOT EXISTS promotion_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "promotionId" UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  "serviceId" TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE ("promotionId", "serviceId")
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions("startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_promotions_is_template ON promotions("isTemplate");
CREATE INDEX IF NOT EXISTS idx_promotion_services_promotion ON promotion_services("promotionId");
CREATE INDEX IF NOT EXISTS idx_promotion_services_service ON promotion_services("serviceId");

-- Bucket de storage para banners (rodar no SQL Editor do Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotion-banners', 'promotion-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Politica de acesso publico para leitura dos banners
CREATE POLICY "Public read promotion banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'promotion-banners');

-- Politica para upload autenticado (service role)
CREATE POLICY "Service role upload promotion banners"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'promotion-banners');

CREATE POLICY "Service role delete promotion banners"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'promotion-banners');
