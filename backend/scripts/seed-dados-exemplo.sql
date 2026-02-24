-- ============================================================
-- SEED COMPLETO - Barbearia América
-- Pré-requisito: Apenas o usuário admin já existe no banco
-- Execute no SQL Editor do Supabase
-- ============================================================

DO $$
DECLARE
  -- IDs de referência
  v_admin_id TEXT;
  v_user_joao_id TEXT;
  v_user_ricardo_id TEXT;
  v_branch_id TEXT;
  v_bank1_id TEXT;
  v_bank2_id TEXT;
  v_pm_dinheiro_id TEXT;
  v_pm_pix_id TEXT;
  v_pm_cartao_id TEXT;
  v_pm_boleto_id TEXT;
  v_prof_joao_id TEXT;
  v_prof_ricardo_id TEXT;
  v_prof_felipe_id TEXT;
  v_prof_andre_id TEXT;
  v_svc_corte_id TEXT;
  v_svc_barba_id TEXT;
  v_svc_combo_id TEXT;
  v_svc_sobrancelha_id TEXT;
  v_svc_pigmentacao_id TEXT;
  v_svc_hidratacao_id TEXT;
  v_svc_infantil_id TEXT;
  v_svc_relaxamento_id TEXT;
  v_svc_platinado_id TEXT;
  v_cli_ids TEXT[];
  v_cli_lucas_id TEXT;
  v_cli_rafael_id TEXT;
  v_cli_bruno_id TEXT;
  v_cli_gustavo_id TEXT;
  v_cli_thiago_id TEXT;
  v_cli_pedro_id TEXT;
  v_cli_matheus_id TEXT;
  v_cli_diego_id TEXT;
  v_cli_rodrigo_id TEXT;
  v_cli_caio_id TEXT;
  v_cli_vinicius_id TEXT;
  v_cli_leonardo_id TEXT;
  v_cli_gabriel_id TEXT;
  v_cli_henrique_id TEXT;
  v_cli_joaopaulo_id TEXT;
  v_prod_pomada_id TEXT;
  v_prod_cera_id TEXT;
  v_prod_oleo_id TEXT;
  v_prod_shampoo_id TEXT;
  v_prod_balm_id TEXT;
  v_prod_pente_id TEXT;
  v_prod_locao_id TEXT;
  v_prod_spray_id TEXT;
  v_plan_basico_id TEXT;
  v_plan_premium_id TEXT;
  v_plan_vip_id TEXT;
  v_caixa_2dias_id TEXT;
  v_caixa_ontem_id TEXT;
  v_caixa_hoje_id TEXT;
  v_apt_id TEXT;
  v_pay_id TEXT;
  v_order_id TEXT;
  v_selected_client TEXT;
  v_selected_prof TEXT;
  v_selected_service TEXT;
  v_price INT;
  v_duration INT;
  v_i INT;
  v_hour INT;
  v_rand FLOAT;
BEGIN

  -- ========================================
  -- 0. BUSCAR ADMIN EXISTENTE
  -- ========================================
  SELECT id INTO v_admin_id FROM users WHERE email = 'admin@barbearia.com' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuário admin não encontrado! Crie o admin primeiro.';
  END IF;
  RAISE NOTICE 'Admin encontrado: %', v_admin_id;

  -- ========================================
  -- 1. FILIAL
  -- ========================================
  v_branch_id := gen_random_uuid()::text;
  INSERT INTO branches (id, name, address, phone, "isActive", "createdAt", "updatedAt")
  VALUES (v_branch_id, 'Barbearia América - Centro', 'Rua das Flores, 123 - Centro', '1133334444', true, now() - interval '6 months', now());
  RAISE NOTICE 'Filial criada';

  -- ========================================
  -- 2. CONTAS BANCÁRIAS
  -- ========================================
  v_bank1_id := gen_random_uuid()::text;
  v_bank2_id := gen_random_uuid()::text;
  INSERT INTO bank_accounts (id, name, bank, "accountType", "isActive", "createdAt", "updatedAt") VALUES
    (v_bank1_id, 'Conta Principal', 'Nubank', 'Conta corrente', true, now() - interval '6 months', now()),
    (v_bank2_id, 'Conta Reserva', 'Inter', 'Conta corrente', true, now() - interval '3 months', now());
  RAISE NOTICE 'Contas bancárias criadas';

  -- ========================================
  -- 3. CONFIGURAÇÃO DE MÉTODOS DE PAGAMENTO
  -- ========================================
  v_pm_dinheiro_id := gen_random_uuid()::text;
  v_pm_pix_id := gen_random_uuid()::text;
  v_pm_cartao_id := gen_random_uuid()::text;
  v_pm_boleto_id := gen_random_uuid()::text;
  INSERT INTO payment_method_configs (id, name, type, scope, "isActive", "createdAt", "updatedAt") VALUES
    (v_pm_dinheiro_id, 'Dinheiro',        'A_VISTA', 'BOTH',    true, now(), now()),
    (v_pm_pix_id,      'PIX',             'A_VISTA', 'BOTH',    true, now(), now()),
    (v_pm_cartao_id,   'Cartão (Débito/Crédito)', 'A_VISTA', 'BOTH', true, now(), now()),
    (v_pm_boleto_id,   'Boleto Bancário', 'A_PRAZO', 'EXPENSE', true, now(), now());
  RAISE NOTICE 'Métodos de pagamento criados';

  -- ========================================
  -- 4. USUÁRIOS (profissionais com login)
  -- ========================================
  v_user_joao_id := gen_random_uuid()::text;
  v_user_ricardo_id := gen_random_uuid()::text;
  -- Senha: 123456 (mesmo hash do admin)
  INSERT INTO users (id, email, password, name, role, "isActive", "createdAt", "updatedAt") VALUES
    (v_user_joao_id,    'joao@barbearia.com',    '$2b$10$Tcd7wgsPNuu92j4g1bfCVeW9kOS7FFV7aKLQOmeJbVpzW3j4f4X8S', 'João Barbeiro',  'PROFESSIONAL', true, now() - interval '5 months', now()),
    (v_user_ricardo_id, 'ricardo@barbearia.com', '$2b$10$Tcd7wgsPNuu92j4g1bfCVeW9kOS7FFV7aKLQOmeJbVpzW3j4f4X8S', 'Ricardo Silva',  'PROFESSIONAL', true, now() - interval '4 months', now());
  RAISE NOTICE 'Usuários profissionais criados';

  -- ========================================
  -- 5. PROFISSIONAIS
  -- ========================================
  v_prof_joao_id    := gen_random_uuid()::text;
  v_prof_ricardo_id := gen_random_uuid()::text;
  v_prof_felipe_id  := gen_random_uuid()::text;
  v_prof_andre_id   := gen_random_uuid()::text;

  INSERT INTO professionals (id, name, phone, email, "commissionRate", "workingHours", "isActive", "userId", "branchId", "createdAt", "updatedAt") VALUES
  (v_prof_joao_id, 'João Barbeiro', '11999999999', 'joao@barbearia.com', 50.00,
    '[{"dayOfWeek":1,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":2,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":3,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":4,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":5,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":6,"startTime":"09:00","endTime":"14:00"}]',
    true, v_user_joao_id, v_branch_id, now() - interval '5 months', now()),
  (v_prof_ricardo_id, 'Ricardo Silva', '11977776666', 'ricardo@barbearia.com', 45.00,
    '[{"dayOfWeek":1,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":2,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":3,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":4,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":5,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":6,"startTime":"09:00","endTime":"14:00"}]',
    true, v_user_ricardo_id, v_branch_id, now() - interval '4 months', now()),
  (v_prof_felipe_id, 'Felipe Santos', '11966665555', 'felipe@barbearia.com', 40.00,
    '[{"dayOfWeek":1,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":2,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":3,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":4,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":5,"startTime":"10:00","endTime":"19:00"}]',
    true, NULL, v_branch_id, now() - interval '3 months', now()),
  (v_prof_andre_id, 'André Oliveira', '11955554444', 'andre@barbearia.com', 50.00,
    '[{"dayOfWeek":2,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":3,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":4,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":5,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":6,"startTime":"08:00","endTime":"13:00"}]',
    true, NULL, v_branch_id, now() - interval '2 months', now());
  RAISE NOTICE 'Profissionais criados';

  -- ========================================
  -- 6. SERVIÇOS
  -- ========================================
  v_svc_corte_id       := gen_random_uuid()::text;
  v_svc_barba_id       := gen_random_uuid()::text;
  v_svc_combo_id       := gen_random_uuid()::text;
  v_svc_sobrancelha_id := gen_random_uuid()::text;
  v_svc_pigmentacao_id := gen_random_uuid()::text;
  v_svc_hidratacao_id  := gen_random_uuid()::text;
  v_svc_infantil_id    := gen_random_uuid()::text;
  v_svc_relaxamento_id := gen_random_uuid()::text;
  v_svc_platinado_id   := gen_random_uuid()::text;

  INSERT INTO services (id, name, description, price, duration, "isActive", "createdAt", "updatedAt") VALUES
    (v_svc_corte_id,       'Corte de Cabelo',      'Corte masculino tradicional ou moderno',   4500, 30,  true, now() - interval '6 months', now()),
    (v_svc_barba_id,       'Barba',                 'Aparar e modelar barba com navalha',       3000, 20,  true, now() - interval '6 months', now()),
    (v_svc_combo_id,       'Corte + Barba',         'Combo completo corte e barba',             6500, 45,  true, now() - interval '6 months', now()),
    (v_svc_sobrancelha_id, 'Sobrancelha',           'Design de sobrancelha masculina',          1500, 10,  true, now() - interval '5 months', now()),
    (v_svc_pigmentacao_id, 'Pigmentação de Barba',  'Preenchimento com pigmento natural',       8000, 40,  true, now() - interval '4 months', now()),
    (v_svc_hidratacao_id,  'Hidratação Capilar',    'Tratamento profundo com queratina',        5000, 30,  true, now() - interval '4 months', now()),
    (v_svc_infantil_id,    'Corte Infantil',        'Corte para crianças até 12 anos',          3500, 25,  true, now() - interval '3 months', now()),
    (v_svc_relaxamento_id, 'Relaxamento',           'Relaxamento capilar progressivo',         12000, 90,  true, now() - interval '2 months', now()),
    (v_svc_platinado_id,   'Platinado',             'Descoloração completa com tratamento',    15000, 120, true, now() - interval '2 months', now());
  RAISE NOTICE 'Serviços criados';

  -- ========================================
  -- 7. VÍNCULO PROFISSIONAL ↔ SERVIÇO
  -- ========================================
  -- João: faz tudo exceto platinado e relaxamento
  INSERT INTO "_ProfessionalToService" ("A", "B") VALUES
    (v_prof_joao_id, v_svc_corte_id),
    (v_prof_joao_id, v_svc_barba_id),
    (v_prof_joao_id, v_svc_combo_id),
    (v_prof_joao_id, v_svc_sobrancelha_id),
    (v_prof_joao_id, v_svc_pigmentacao_id),
    (v_prof_joao_id, v_svc_hidratacao_id),
    (v_prof_joao_id, v_svc_infantil_id);
  -- Ricardo: corte, barba, combo, sobrancelha, infantil
  INSERT INTO "_ProfessionalToService" ("A", "B") VALUES
    (v_prof_ricardo_id, v_svc_corte_id),
    (v_prof_ricardo_id, v_svc_barba_id),
    (v_prof_ricardo_id, v_svc_combo_id),
    (v_prof_ricardo_id, v_svc_sobrancelha_id),
    (v_prof_ricardo_id, v_svc_infantil_id);
  -- Felipe: corte, barba, combo, sobrancelha
  INSERT INTO "_ProfessionalToService" ("A", "B") VALUES
    (v_prof_felipe_id, v_svc_corte_id),
    (v_prof_felipe_id, v_svc_barba_id),
    (v_prof_felipe_id, v_svc_combo_id),
    (v_prof_felipe_id, v_svc_sobrancelha_id);
  -- André: especialista - faz tudo incluindo platinado e relaxamento
  INSERT INTO "_ProfessionalToService" ("A", "B") VALUES
    (v_prof_andre_id, v_svc_corte_id),
    (v_prof_andre_id, v_svc_barba_id),
    (v_prof_andre_id, v_svc_combo_id),
    (v_prof_andre_id, v_svc_sobrancelha_id),
    (v_prof_andre_id, v_svc_pigmentacao_id),
    (v_prof_andre_id, v_svc_hidratacao_id),
    (v_prof_andre_id, v_svc_relaxamento_id),
    (v_prof_andre_id, v_svc_platinado_id);
  RAISE NOTICE 'Vínculos profissional-serviço criados';

  -- ========================================
  -- 8. CLIENTES
  -- ========================================
  v_cli_lucas_id     := gen_random_uuid()::text;
  v_cli_rafael_id    := gen_random_uuid()::text;
  v_cli_bruno_id     := gen_random_uuid()::text;
  v_cli_gustavo_id   := gen_random_uuid()::text;
  v_cli_thiago_id    := gen_random_uuid()::text;
  v_cli_pedro_id     := gen_random_uuid()::text;
  v_cli_matheus_id   := gen_random_uuid()::text;
  v_cli_diego_id     := gen_random_uuid()::text;
  v_cli_rodrigo_id   := gen_random_uuid()::text;
  v_cli_caio_id      := gen_random_uuid()::text;
  v_cli_vinicius_id  := gen_random_uuid()::text;
  v_cli_leonardo_id  := gen_random_uuid()::text;
  v_cli_gabriel_id   := gen_random_uuid()::text;
  v_cli_henrique_id  := gen_random_uuid()::text;
  v_cli_joaopaulo_id := gen_random_uuid()::text;

  INSERT INTO clients (id, name, email, phone, "hasDebts", "isActive", notes, "createdAt", "updatedAt") VALUES
    (v_cli_lucas_id,     'Lucas Mendes',        'lucas.mendes@gmail.com',       '11991001001', false, true, 'Cliente fiel, vem toda semana. Prefere com o João.',                now() - interval '90 days',  now()),
    (v_cli_rafael_id,    'Rafael Costa',         'rafael.costa@hotmail.com',     '11992002002', false, true, NULL,                                                                now() - interval '60 days',  now()),
    (v_cli_bruno_id,     'Bruno Almeida',        'bruno.almeida@gmail.com',      '11993003003', false, true, 'Prefere corte degradê. Sempre pede pra deixar o topo mais longo.',  now() - interval '45 days',  now()),
    (v_cli_gustavo_id,   'Gustavo Pereira',      'gustavo.p@outlook.com',        '11994004004', false, true, NULL,                                                                now() - interval '30 days',  now()),
    (v_cli_thiago_id,    'Thiago Rocha',         'thiago.rocha@gmail.com',       '11995005005', true,  true, 'Tem dívida pendente - combinou pagar semana que vem.',              now() - interval '75 days',  now()),
    (v_cli_pedro_id,     'Pedro Henrique',        'pedro.h@gmail.com',            '11996006006', false, true, 'Faz corte e barba sempre juntos.',                                  now() - interval '20 days',  now()),
    (v_cli_matheus_id,   'Matheus Lima',          'matheus.lima@yahoo.com',       '11997007007', false, true, 'Assinante do plano Premium. Muito satisfeito.',                     now() - interval '50 days',  now()),
    (v_cli_diego_id,     'Diego Ferreira',        'diego.f@gmail.com',            '11998008008', false, true, NULL,                                                                now() - interval '15 days',  now()),
    (v_cli_rodrigo_id,   'Rodrigo Souza',         'rodrigo.souza@gmail.com',      '11999009009', true,  true, 'Dívida antiga parcialmente paga. Combinado parcelar.',              now() - interval '100 days', now()),
    (v_cli_caio_id,      'Caio Martins',          'caio.martins@gmail.com',       '11990010010', false, true, NULL,                                                                now() - interval '10 days',  now()),
    (v_cli_vinicius_id,  'Vinícius Barbosa',      'vinicius.b@hotmail.com',       '11991011011', false, true, 'Cliente novo, indicado pelo Caio.',                                 now() - interval '5 days',   now()),
    (v_cli_leonardo_id,  'Leonardo Gomes',         'leo.gomes@gmail.com',          '11992012012', false, true, NULL,                                                                now() - interval '40 days',  now()),
    (v_cli_gabriel_id,   'Gabriel Nascimento',     'gabriel.n@gmail.com',          '11993013013', false, true, 'Indicado pelo Lucas. Gosta de corte social.',                       now() - interval '25 days',  now()),
    (v_cli_henrique_id,  'Henrique Dias',          'henrique.dias@outlook.com',    '11994014014', false, true, NULL,                                                                now() - interval '35 days',  now()),
    (v_cli_joaopaulo_id, 'João Paulo',             NULL,                           '11995015015', false, true, 'Sem email cadastrado. Cliente walk-in.',                            now() - interval '8 days',   now());

  v_cli_ids := ARRAY[
    v_cli_lucas_id, v_cli_rafael_id, v_cli_bruno_id, v_cli_gustavo_id,
    v_cli_thiago_id, v_cli_pedro_id, v_cli_matheus_id, v_cli_diego_id,
    v_cli_rodrigo_id, v_cli_caio_id, v_cli_vinicius_id, v_cli_leonardo_id,
    v_cli_gabriel_id, v_cli_henrique_id, v_cli_joaopaulo_id
  ];
  RAISE NOTICE 'Clientes criados: %', array_length(v_cli_ids, 1);

  -- ========================================
  -- 9. PRODUTOS (vinculados à filial)
  -- ========================================
  v_prod_pomada_id  := gen_random_uuid()::text;
  v_prod_cera_id    := gen_random_uuid()::text;
  v_prod_oleo_id    := gen_random_uuid()::text;
  v_prod_shampoo_id := gen_random_uuid()::text;
  v_prod_balm_id    := gen_random_uuid()::text;
  v_prod_pente_id   := gen_random_uuid()::text;
  v_prod_locao_id   := gen_random_uuid()::text;
  v_prod_spray_id   := gen_random_uuid()::text;

  INSERT INTO products (id, name, description, "costPrice", "salePrice", "minStock", "isActive", "branchId", "createdAt", "updatedAt") VALUES
    (v_prod_pomada_id,  'Pomada Modeladora',  'Pomada matte para cabelo, 150g',         1500, 4500, 5,  true, v_branch_id, now() - interval '3 months', now()),
    (v_prod_cera_id,    'Cera Capilar',       'Cera de fixação forte, 100g',            1200, 3500, 5,  true, v_branch_id, now() - interval '3 months', now()),
    (v_prod_oleo_id,    'Óleo para Barba',    'Óleo hidratante para barba, 30ml',       2000, 5500, 3,  true, v_branch_id, now() - interval '3 months', now()),
    (v_prod_shampoo_id, 'Shampoo Masculino',  'Shampoo anticaspa 300ml',                 800, 2500, 10, true, v_branch_id, now() - interval '3 months', now()),
    (v_prod_balm_id,    'Balm para Barba',    'Balm hidratante e modelador, 60g',       1800, 4800, 3,  true, v_branch_id, now() - interval '2 months', now()),
    (v_prod_pente_id,   'Pente de Madeira',   'Pente artesanal de madeira',              500, 2000, 8,  true, v_branch_id, now() - interval '2 months', now()),
    (v_prod_locao_id,   'Loção Pós-Barba',    'Loção refrescante 100ml',               1000, 3000, 5,  true, v_branch_id, now() - interval '2 months', now()),
    (v_prod_spray_id,   'Spray Fixador',      'Spray de fixação média 250ml',            900, 2800, 5,  true, v_branch_id, now() - interval '1 month',  now());
  RAISE NOTICE 'Produtos criados';

  -- ========================================
  -- 10. MOVIMENTAÇÕES DE ESTOQUE
  -- ========================================
  -- Entradas iniciais (há 30 dias)
  INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId", "branchId") VALUES
    (gen_random_uuid()::text, 'ENTRY', 20, 'Estoque inicial',                 now() - interval '30 days', v_prod_pomada_id,  v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 15, 'Estoque inicial',                 now() - interval '30 days', v_prod_cera_id,    v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 10, 'Estoque inicial',                 now() - interval '30 days', v_prod_oleo_id,    v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 25, 'Estoque inicial',                 now() - interval '30 days', v_prod_shampoo_id, v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 8,  'Estoque inicial',                 now() - interval '30 days', v_prod_balm_id,    v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 12, 'Estoque inicial',                 now() - interval '30 days', v_prod_pente_id,   v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 15, 'Estoque inicial',                 now() - interval '30 days', v_prod_locao_id,   v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 18, 'Estoque inicial',                 now() - interval '30 days', v_prod_spray_id,   v_branch_id);
  -- Reposição (há 10 dias)
  INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId", "branchId") VALUES
    (gen_random_uuid()::text, 'ENTRY', 10, 'Reposição - Fornecedor Alpha',    now() - interval '10 days', v_prod_pomada_id,  v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 8,  'Reposição - Fornecedor Alpha',    now() - interval '10 days', v_prod_oleo_id,    v_branch_id),
    (gen_random_uuid()::text, 'ENTRY', 15, 'Reposição - Fornecedor Beta',     now() - interval '10 days', v_prod_shampoo_id, v_branch_id);
  -- Saídas (vendas)
  INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId", "branchId") VALUES
    (gen_random_uuid()::text, 'EXIT', 12, 'Vendas do mês',                    now() - interval '15 days', v_prod_pomada_id,  v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 5,  'Vendas do mês',                    now() - interval '15 days', v_prod_oleo_id,    v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 4,  'Vendas do mês',                    now() - interval '15 days', v_prod_cera_id,    v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 8,  'Vendas do mês',                    now() - interval '12 days', v_prod_shampoo_id, v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 3,  'Vendas do mês',                    now() - interval '8 days',  v_prod_balm_id,    v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 6,  'Vendas do mês',                    now() - interval '5 days',  v_prod_pente_id,   v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 7,  'Vendas do mês',                    now() - interval '3 days',  v_prod_locao_id,   v_branch_id),
    (gen_random_uuid()::text, 'EXIT', 4,  'Vendas do mês',                    now() - interval '2 days',  v_prod_spray_id,   v_branch_id);
  RAISE NOTICE 'Movimentações de estoque criadas';

  -- ========================================
  -- 11. PLANOS DE ASSINATURA
  -- ========================================
  v_plan_basico_id  := gen_random_uuid()::text;
  v_plan_premium_id := gen_random_uuid()::text;
  v_plan_vip_id     := gen_random_uuid()::text;

  INSERT INTO subscription_plans (id, name, description, price, "cutsPerMonth", "isActive", "createdAt", "updatedAt") VALUES
    (v_plan_basico_id,  'Plano Básico',   '2 cortes por mês',                              7000,  2, true, now() - interval '4 months', now()),
    (v_plan_premium_id, 'Plano Premium',   '4 cortes por mês + barba inclusa',             12000,  4, true, now() - interval '4 months', now()),
    (v_plan_vip_id,     'Plano VIP',       'Cortes ilimitados + barba + sobrancelha',      18000,  8, true, now() - interval '4 months', now());
  RAISE NOTICE 'Planos de assinatura criados';

  -- ========================================
  -- 12. ASSINATURAS DE CLIENTES
  -- ========================================
  INSERT INTO client_subscriptions (id, status, "startDate", "endDate", "cutsUsedThisMonth", "lastResetDate", "clientId", "planId", "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 'ACTIVE', now() - interval '20 days', now() + interval '10 days', 2, date_trunc('month', now()), v_cli_matheus_id, v_plan_premium_id, now() - interval '20 days', now()),
    (gen_random_uuid()::text, 'ACTIVE', now() - interval '15 days', now() + interval '15 days', 1, date_trunc('month', now()), v_cli_lucas_id,   v_plan_vip_id,     now() - interval '15 days', now()),
    (gen_random_uuid()::text, 'ACTIVE', now() - interval '5 days',  now() + interval '25 days', 0, date_trunc('month', now()), v_cli_pedro_id,   v_plan_basico_id,  now() - interval '5 days',  now());
  RAISE NOTICE 'Assinaturas de clientes criadas';


  -- ========================================
  -- 14. CAIXAS (3 dias: anteontem fechado, ontem fechado, hoje aberto)
  -- ========================================
  v_caixa_2dias_id := gen_random_uuid()::text;
  v_caixa_ontem_id := gen_random_uuid()::text;
  v_caixa_hoje_id  := gen_random_uuid()::text;

  INSERT INTO cash_registers (id, date, "openedAt", "openingBalance", "closedAt", "closingBalance", "totalCash", "totalPix", "totalCard", "totalRevenue", discrepancy, "isOpen", "openedBy", "closedBy", "createdAt", "updatedAt") VALUES
    (v_caixa_2dias_id,
      (now() - interval '2 days')::date,
      (now() - interval '2 days')::date + '09:00'::time,
      10000,
      (now() - interval '2 days')::date + '18:30'::time,
      48500,
      18500, 17000, 13000, 48500, 0, false,
      v_admin_id, v_admin_id,
      now() - interval '2 days', now() - interval '2 days'),
    (v_caixa_ontem_id,
      (now() - interval '1 day')::date,
      (now() - interval '1 day')::date + '09:00'::time,
      10000,
      (now() - interval '1 day')::date + '18:15'::time,
      55000,
      22000, 20000, 13000, 55000, 0, false,
      v_admin_id, v_admin_id,
      now() - interval '1 day', now() - interval '1 day');

  INSERT INTO cash_registers (id, date, "openedAt", "openingBalance", "isOpen", "openedBy", "createdAt", "updatedAt") VALUES
    (v_caixa_hoje_id,
      now()::date,
      now()::date + '09:00'::time,
      10000, true,
      v_admin_id,
      now(), now());
  RAISE NOTICE 'Caixas criados';

  -- ========================================
  -- 15. AGENDAMENTOS PASSADOS (ATTENDED) + PAGAMENTOS
  --     Últimos 30 dias, ~2 por dia
  -- ========================================
  FOR v_i IN 1..40 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_pay_id := gen_random_uuid()::text;

    -- Distribuir clientes de forma variada
    v_selected_client := v_cli_ids[1 + (v_i % array_length(v_cli_ids, 1))];

    -- Distribuir profissionais
    CASE (v_i % 4)
      WHEN 0 THEN v_selected_prof := v_prof_joao_id;
      WHEN 1 THEN v_selected_prof := v_prof_ricardo_id;
      WHEN 2 THEN v_selected_prof := v_prof_felipe_id;
      WHEN 3 THEN v_selected_prof := v_prof_andre_id;
    END CASE;

    -- Distribuir serviços
    v_rand := (v_i % 7)::float / 7.0;
    IF v_rand < 0.35 THEN
      v_selected_service := v_svc_combo_id; v_price := 6500; v_duration := 45;
    ELSIF v_rand < 0.60 THEN
      v_selected_service := v_svc_corte_id; v_price := 4500; v_duration := 30;
    ELSIF v_rand < 0.75 THEN
      v_selected_service := v_svc_barba_id; v_price := 3000; v_duration := 20;
    ELSIF v_rand < 0.85 THEN
      v_selected_service := v_svc_sobrancelha_id; v_price := 1500; v_duration := 10;
    ELSE
      v_selected_service := v_svc_hidratacao_id; v_price := 5000; v_duration := 30;
    END IF;

    -- Horário entre 9h e 17h
    v_hour := 9 + (v_i % 9);

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "attendedAt", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      (now() - ((1 + v_i / 2) || ' days')::interval)::date + (v_hour || ':00')::time + (CASE WHEN v_i % 2 = 0 THEN '0 min' ELSE '30 min' END)::interval,
      'ATTENDED', v_price, v_duration, true,
      (now() - ((1 + v_i / 2) || ' days')::interval)::date + ((v_hour + 1) || ':00')::time,
      v_selected_client, v_selected_prof,
      now() - ((1 + v_i / 2) || ' days')::interval,
      now() - ((1 + v_i / 2) || ' days')::interval
    );

    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_selected_service, now() - ((1 + v_i / 2) || ' days')::interval);

    -- Pagamento com método variado
    INSERT INTO payments (id, amount, method, "paidAt", "clientId", "registeredBy", "appointmentId", "cashRegisterId", "createdAt", "updatedAt")
    VALUES (
      v_pay_id, v_price,
      CASE (v_i % 3) WHEN 0 THEN 'PIX'::"PaymentMethod" WHEN 1 THEN 'CASH'::"PaymentMethod" ELSE 'CARD'::"PaymentMethod" END,
      (now() - ((1 + v_i / 2) || ' days')::interval)::date + ((v_hour + 1) || ':00')::time,
      v_selected_client, v_admin_id, v_apt_id,
      -- Vincular ao caixa correto baseado na data
      CASE
        WHEN (1 + v_i / 2) = 1 THEN v_caixa_ontem_id
        WHEN (1 + v_i / 2) = 2 THEN v_caixa_2dias_id
        ELSE NULL
      END,
      now() - ((1 + v_i / 2) || ' days')::interval,
      now() - ((1 + v_i / 2) || ' days')::interval
    );
  END LOOP;
  RAISE NOTICE 'Agendamentos passados e pagamentos criados (40)';

  -- ========================================
  -- 16. AGENDAMENTOS FUTUROS (SCHEDULED)
  --     Próximos 10 dias
  -- ========================================
  FOR v_i IN 1..18 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_cli_ids[1 + (v_i * 3 % array_length(v_cli_ids, 1))];

    CASE (v_i % 4)
      WHEN 0 THEN v_selected_prof := v_prof_joao_id;
      WHEN 1 THEN v_selected_prof := v_prof_ricardo_id;
      WHEN 2 THEN v_selected_prof := v_prof_felipe_id;
      WHEN 3 THEN v_selected_prof := v_prof_andre_id;
    END CASE;

    CASE (v_i % 5)
      WHEN 0 THEN v_selected_service := v_svc_combo_id;       v_price := 6500;  v_duration := 45;
      WHEN 1 THEN v_selected_service := v_svc_corte_id;       v_price := 4500;  v_duration := 30;
      WHEN 2 THEN v_selected_service := v_svc_barba_id;       v_price := 3000;  v_duration := 20;
      WHEN 3 THEN v_selected_service := v_svc_combo_id;       v_price := 6500;  v_duration := 45;
      WHEN 4 THEN v_selected_service := v_svc_pigmentacao_id; v_price := 8000;  v_duration := 40;
    END CASE;

    v_hour := 9 + (v_i % 9);

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      (now() + (v_i || ' days')::interval)::date + (v_hour || ':00')::time + (CASE WHEN v_i % 2 = 0 THEN '0 min' ELSE '30 min' END)::interval,
      'SCHEDULED', v_price, v_duration, false,
      v_selected_client, v_selected_prof, now(), now()
    );

    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_selected_service, now());
  END LOOP;
  RAISE NOTICE 'Agendamentos futuros criados (18)';

  -- ========================================
  -- 17. AGENDAMENTOS CANCELADOS E NO-SHOW
  -- ========================================
  -- 3 cancelados
  FOR v_i IN 1..3 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_cli_ids[5 + v_i]; -- clientes variados

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "canceledAt", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      now() - ((4 + v_i) || ' days')::interval + '14:00'::interval,
      'CANCELED', 4500, 30, false,
      now() - ((4 + v_i + 1) || ' days')::interval,
      v_selected_client, v_prof_joao_id,
      now() - ((5 + v_i) || ' days')::interval, now() - ((4 + v_i) || ' days')::interval
    );

    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_svc_corte_id, now());
  END LOOP;

  -- 2 no-show
  FOR v_i IN 1..2 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_cli_ids[9 + v_i];

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      now() - ((7 + v_i) || ' days')::interval + '16:00'::interval,
      'NO_SHOW', 6500, 45, false,
      v_selected_client, v_prof_ricardo_id,
      now() - ((8 + v_i) || ' days')::interval, now() - ((7 + v_i) || ' days')::interval
    );

    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_svc_combo_id, now());
  END LOOP;
  RAISE NOTICE 'Agendamentos cancelados e no-show criados';

  -- ========================================
  -- 18. DÍVIDAS (FIADO)
  -- ========================================
  INSERT INTO debts (id, amount, "amountPaid", "remainingBalance", description, "dueDate", "isSettled", "clientId", "createdAt", "updatedAt") VALUES
    -- Thiago: dívida ativa
    (gen_random_uuid()::text, 6500, 0, 6500, 'Corte + Barba não pago - ficou no fiado',
      now() + interval '7 days', false, v_cli_thiago_id, now() - interval '5 days', now()),
    -- Rodrigo: dívida parcialmente paga
    (gen_random_uuid()::text, 13000, 4500, 8500, 'Dois atendimentos pendentes, pagou R$45 adiantado',
      now() - interval '3 days', false, v_cli_rodrigo_id, now() - interval '20 days', now()),
    -- Lucas: dívida quitada (histórico)
    (gen_random_uuid()::text, 4500, 4500, 0, 'Corte pago com atraso - quitado',
      now() - interval '15 days', true, v_cli_lucas_id, now() - interval '25 days', now() - interval '15 days');
  RAISE NOTICE 'Dívidas criadas';


  -- ========================================
  -- 20. COMISSÕES
  -- ========================================
  -- Mês passado (PAGAS)
  INSERT INTO commissions (id, amount, "periodStart", "periodEnd", status, "paidAt", "professionalId", "branchId", notes, "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 32500,
      date_trunc('month', now() - interval '1 month'),
      date_trunc('month', now()) - interval '1 second',
      'PAID', date_trunc('month', now()) + interval '5 days',
      v_prof_joao_id, v_branch_id, '65 atendimentos no mês',
      date_trunc('month', now()) + interval '5 days', date_trunc('month', now()) + interval '5 days'),
    (gen_random_uuid()::text, 27000,
      date_trunc('month', now() - interval '1 month'),
      date_trunc('month', now()) - interval '1 second',
      'PAID', date_trunc('month', now()) + interval '5 days',
      v_prof_ricardo_id, v_branch_id, '52 atendimentos no mês',
      date_trunc('month', now()) + interval '5 days', date_trunc('month', now()) + interval '5 days'),
    (gen_random_uuid()::text, 18000,
      date_trunc('month', now() - interval '1 month'),
      date_trunc('month', now()) - interval '1 second',
      'PAID', date_trunc('month', now()) + interval '5 days',
      v_prof_felipe_id, v_branch_id, '40 atendimentos no mês',
      date_trunc('month', now()) + interval '5 days', date_trunc('month', now()) + interval '5 days'),
    (gen_random_uuid()::text, 35000,
      date_trunc('month', now() - interval '1 month'),
      date_trunc('month', now()) - interval '1 second',
      'PAID', date_trunc('month', now()) + interval '5 days',
      v_prof_andre_id, v_branch_id, '48 atendimentos (inclui platinados)',
      date_trunc('month', now()) + interval '5 days', date_trunc('month', now()) + interval '5 days');

  -- Mês atual (PENDENTES)
  INSERT INTO commissions (id, amount, "periodStart", "periodEnd", status, "professionalId", "branchId", notes, "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 21000,
      date_trunc('month', now()), now(),
      'PENDING', v_prof_joao_id, v_branch_id, 'Parcial - mês em andamento', now(), now()),
    (gen_random_uuid()::text, 17500,
      date_trunc('month', now()), now(),
      'PENDING', v_prof_ricardo_id, v_branch_id, 'Parcial - mês em andamento', now(), now()),
    (gen_random_uuid()::text, 12000,
      date_trunc('month', now()), now(),
      'PENDING', v_prof_felipe_id, v_branch_id, 'Parcial - mês em andamento', now(), now()),
    (gen_random_uuid()::text, 23000,
      date_trunc('month', now()), now(),
      'PENDING', v_prof_andre_id, v_branch_id, 'Parcial - mês em andamento', now(), now());
  RAISE NOTICE 'Comissões criadas';

  -- ========================================
  -- 21. BLOQUEIOS DE HORÁRIO
  -- ========================================
  INSERT INTO time_blocks (id, "startTime", "endTime", reason, "createdAt", "professionalId") VALUES
    -- João: almoço amanhã
    (gen_random_uuid()::text,
      (now() + interval '1 day')::date + '12:00'::time,
      (now() + interval '1 day')::date + '13:00'::time,
      'Horário de almoço', now(), v_prof_joao_id),
    -- Ricardo: consulta médica em 3 dias
    (gen_random_uuid()::text,
      (now() + interval '3 days')::date + '14:00'::time,
      (now() + interval '3 days')::date + '16:00'::time,
      'Consulta médica', now(), v_prof_ricardo_id),
    -- Felipe: folga na sexta
    (gen_random_uuid()::text,
      (now() + interval '5 days')::date + '08:00'::time,
      (now() + interval '5 days')::date + '20:00'::time,
      'Dia de folga', now(), v_prof_felipe_id),
    -- André: curso de especialização
    (gen_random_uuid()::text,
      (now() + interval '7 days')::date + '08:00'::time,
      (now() + interval '7 days')::date + '12:00'::time,
      'Curso de colorimetria', now(), v_prof_andre_id);
  RAISE NOTICE 'Bloqueios de horário criados';

  -- ========================================
  -- 22. COMANDAS (ORDERS)
  -- ========================================

  -- Comanda 1: Paga - Lucas comprou pomada + corte com João (há 3 dias)
  v_order_id := gen_random_uuid()::text;
  v_pay_id := gen_random_uuid()::text;
  INSERT INTO payments (id, amount, method, "paidAt", "clientId", "registeredBy", "cashRegisterId", "createdAt", "updatedAt")
  VALUES (v_pay_id, 9000, 'PIX', now() - interval '3 days', v_cli_lucas_id, v_admin_id, NULL, now() - interval '3 days', now() - interval '3 days');

  INSERT INTO orders (id, status, "totalAmount", notes, "clientId", "professionalId", "branchId", "paymentId", "createdAt", "updatedAt")
  VALUES (v_order_id, 'PAID', 9000, NULL, v_cli_lucas_id, v_prof_joao_id, v_branch_id, v_pay_id, now() - interval '3 days', now() - interval '3 days');

  INSERT INTO order_items (id, quantity, "unitPrice", "itemType", "orderId", "productId", "serviceId") VALUES
    (gen_random_uuid()::text, 1, 4500, 'SERVICE', v_order_id, NULL, v_svc_corte_id),
    (gen_random_uuid()::text, 1, 4500, 'PRODUCT', v_order_id, v_prod_pomada_id, NULL);

  -- Comanda 2: Paga - Bruno comprou óleo + balm (há 2 dias)
  v_order_id := gen_random_uuid()::text;
  v_pay_id := gen_random_uuid()::text;
  INSERT INTO payments (id, amount, method, "paidAt", "clientId", "registeredBy", "cashRegisterId", "createdAt", "updatedAt")
  VALUES (v_pay_id, 10300, 'CARD', now() - interval '2 days', v_cli_bruno_id, v_admin_id, v_caixa_2dias_id, now() - interval '2 days', now() - interval '2 days');

  INSERT INTO orders (id, status, "totalAmount", notes, "clientId", "professionalId", "branchId", "paymentId", "createdAt", "updatedAt")
  VALUES (v_order_id, 'PAID', 10300, NULL, v_cli_bruno_id, v_prof_ricardo_id, v_branch_id, v_pay_id, now() - interval '2 days', now() - interval '2 days');

  INSERT INTO order_items (id, quantity, "unitPrice", "itemType", "orderId", "productId", "serviceId") VALUES
    (gen_random_uuid()::text, 1, 5500, 'PRODUCT', v_order_id, v_prod_oleo_id, NULL),
    (gen_random_uuid()::text, 1, 4800, 'PRODUCT', v_order_id, v_prod_balm_id, NULL);

  -- Comanda 3: Paga - Caio: combo + shampoo (ontem)
  v_order_id := gen_random_uuid()::text;
  v_pay_id := gen_random_uuid()::text;
  INSERT INTO payments (id, amount, method, "paidAt", "clientId", "registeredBy", "cashRegisterId", "createdAt", "updatedAt")
  VALUES (v_pay_id, 9000, 'CASH', now() - interval '1 day', v_cli_caio_id, v_admin_id, v_caixa_ontem_id, now() - interval '1 day', now() - interval '1 day');

  INSERT INTO orders (id, status, "totalAmount", notes, "clientId", "professionalId", "branchId", "paymentId", "createdAt", "updatedAt")
  VALUES (v_order_id, 'PAID', 9000, NULL, v_cli_caio_id, v_prof_felipe_id, v_branch_id, v_pay_id, now() - interval '1 day', now() - interval '1 day');

  INSERT INTO order_items (id, quantity, "unitPrice", "itemType", "orderId", "productId", "serviceId") VALUES
    (gen_random_uuid()::text, 1, 6500, 'SERVICE', v_order_id, NULL, v_svc_combo_id),
    (gen_random_uuid()::text, 1, 2500, 'PRODUCT', v_order_id, v_prod_shampoo_id, NULL);

  -- Comanda 4: Pendente - Diego: corte + pomada + pente (hoje, ainda não pagou)
  v_order_id := gen_random_uuid()::text;
  INSERT INTO orders (id, status, "totalAmount", notes, "clientId", "professionalId", "branchId", "createdAt", "updatedAt")
  VALUES (v_order_id, 'PENDING', 11000, 'Aguardando pagamento', v_cli_diego_id, v_prof_joao_id, v_branch_id, now(), now());

  INSERT INTO order_items (id, quantity, "unitPrice", "itemType", "orderId", "productId", "serviceId") VALUES
    (gen_random_uuid()::text, 1, 4500, 'SERVICE', v_order_id, NULL, v_svc_corte_id),
    (gen_random_uuid()::text, 1, 4500, 'PRODUCT', v_order_id, v_prod_pomada_id, NULL),
    (gen_random_uuid()::text, 1, 2000, 'PRODUCT', v_order_id, v_prod_pente_id, NULL);

  -- Comanda 5: Cancelada - Vinícius (há 4 dias)
  v_order_id := gen_random_uuid()::text;
  INSERT INTO orders (id, status, "totalAmount", notes, "clientId", "professionalId", "branchId", "createdAt", "updatedAt")
  VALUES (v_order_id, 'CANCELED', 6500, 'Cliente desistiu', v_cli_vinicius_id, v_prof_andre_id, v_branch_id, now() - interval '4 days', now() - interval '4 days');

  INSERT INTO order_items (id, quantity, "unitPrice", "itemType", "orderId", "productId", "serviceId") VALUES
    (gen_random_uuid()::text, 1, 6500, 'SERVICE', v_order_id, NULL, v_svc_combo_id);

  RAISE NOTICE 'Comandas criadas';

  -- ========================================
  -- CONCLUÍDO!
  -- ========================================
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'SEED COMPLETO!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Resumo:';
  RAISE NOTICE '  - 1 filial';
  RAISE NOTICE '  - 2 contas bancárias';
  RAISE NOTICE '  - 4 métodos de pagamento';
  RAISE NOTICE '  - 3 usuários (1 admin + 2 profissionais)';
  RAISE NOTICE '  - 4 profissionais (2 com login)';
  RAISE NOTICE '  - 9 serviços';
  RAISE NOTICE '  - 15 clientes';
  RAISE NOTICE '  - 8 produtos + movimentações de estoque';
  RAISE NOTICE '  - 3 planos de assinatura + 3 assinantes';
  RAISE NOTICE '  - 14 categorias financeiras (com subcategorias)';
  RAISE NOTICE '  - 40 agendamentos passados (com pagamentos)';
  RAISE NOTICE '  - 18 agendamentos futuros';
  RAISE NOTICE '  - 5 agendamentos cancelados/no-show';
  RAISE NOTICE '  - 3 dívidas (1 ativa, 1 parcial, 1 quitada)';
  RAISE NOTICE '  - 3 caixas (2 fechados + 1 aberto hoje)';
  RAISE NOTICE '  - 11 transações financeiras (7 despesas + 4 receitas)';
  RAISE NOTICE '  - 8 comissões (4 pagas + 4 pendentes)';
  RAISE NOTICE '  - 4 bloqueios de horário';
  RAISE NOTICE '  - 5 comandas (3 pagas + 1 pendente + 1 cancelada)';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Login admin: admin@barbearia.com / 123456';
  RAISE NOTICE 'Login João:  joao@barbearia.com / 123456';
  RAISE NOTICE 'Login Ricardo: ricardo@barbearia.com / 123456';
  RAISE NOTICE '==========================================';

END $$;
