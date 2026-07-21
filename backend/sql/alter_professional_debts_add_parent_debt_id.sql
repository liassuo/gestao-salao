-- Vínculo REAL entre o registro-ledger de dedução e o débito-pai.
--
-- Antes, a dedução parcial criava um registro "ledger" cujo único vínculo com o
-- débito-pai era um prefixo de 8 caracteres do UUID embutido na DESCRIÇÃO
-- ("Dedução parcial do débito ab12cd34..."), resolvido depois via LIKE — frágil
-- e ambíguo. Pior: a quitação TOTAL nem criava ledger, então o estorno (ao
-- regerar comissão) não sabia QUANTO aquela comissão tinha coberto e restaurava
-- o débito ao valor ORIGINAL inteiro, ressuscitando partes já descontadas por
-- OUTRAS comissões — o "bola de neve" de julho/2026 (débito descontado crescia
-- a cada clique em "Gerar comissão").
--
-- Com parentDebtId, TODA dedução (total ou parcial) grava um ledger apontando
-- para o pai com o valor exato coberto, e o estorno devolve exatamente isso.
ALTER TABLE professional_debts
  ADD COLUMN IF NOT EXISTS "parentDebtId" UUID REFERENCES professional_debts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_professional_debts_parent
  ON professional_debts("parentDebtId");

-- Backfill dos ledgers antigos: resolve o pai pelo prefixo da descrição, como o
-- código legado fazia, mas uma única vez e de forma auditável.
UPDATE professional_debts l
SET "parentDebtId" = p.id
FROM professional_debts p
WHERE l."parentDebtId" IS NULL
  AND l.description LIKE 'Dedução parcial do débito %'
  AND (p.description IS NULL OR p.description NOT LIKE 'Dedução parcial do débito %')
  AND p."professionalId" = l."professionalId"
  AND left(p.id::text, 8) = substring(l.description from 'Dedução parcial do débito ([0-9a-f]{8})');

-- Conferência: ledgers que continuarem sem pai após o backfill (pai apagado ou
-- prefixo ambíguo) devem ser tratados no script de reparo de dados.
-- SELECT id, description FROM professional_debts
--  WHERE description LIKE 'Dedução parcial do débito %' AND "parentDebtId" IS NULL;
