-- ============================================
-- DADOS DE EXEMPLO - Barbearia América
-- Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. SERVIÇOS EXTRAS
-- ============================================
INSERT INTO services (id, name, description, price, duration, "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Sobrancelha', 'Design de sobrancelha masculina', 1500, 10, true, now(), now()),
  (gen_random_uuid()::text, 'Pigmentação de Barba', 'Preenchimento com pigmento', 8000, 40, true, now(), now()),
  (gen_random_uuid()::text, 'Hidratação Capilar', 'Tratamento com queratina', 5000, 30, true, now(), now()),
  (gen_random_uuid()::text, 'Corte Infantil', 'Corte para crianças até 12 anos', 3500, 25, true, now(), now()),
  (gen_random_uuid()::text, 'Relaxamento', 'Relaxamento capilar progressivo', 12000, 90, true, now(), now()),
  (gen_random_uuid()::text, 'Platinado', 'Descoloração completa', 15000, 120, true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. PROFISSIONAIS
-- ============================================
INSERT INTO professionals (id, name, phone, email, "commissionRate", "workingHours", "isActive", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::text, 'Ricardo Silva', '11977776666', 'ricardo@barbearia.com', 45.00,
  '[{"dayOfWeek":1,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":2,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":3,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":4,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":5,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":6,"startTime":"09:00","endTime":"14:00"}]',
  true, now(), now()),
(gen_random_uuid()::text, 'Felipe Santos', '11966665555', 'felipe@barbearia.com', 40.00,
  '[{"dayOfWeek":1,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":2,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":3,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":4,"startTime":"10:00","endTime":"19:00"},{"dayOfWeek":5,"startTime":"10:00","endTime":"19:00"}]',
  true, now(), now()),
(gen_random_uuid()::text, 'André Oliveira', '11955554444', 'andre@barbearia.com', 50.00,
  '[{"dayOfWeek":2,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":3,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":4,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":5,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":6,"startTime":"08:00","endTime":"13:00"}]',
  true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CLIENTES
-- ============================================
INSERT INTO clients (id, name, email, phone, "hasDebts", "isActive", notes, "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Lucas Mendes', 'lucas.mendes@gmail.com', '11991001001', false, true, 'Cliente fiel, vem toda semana', now() - interval '90 days', now()),
  (gen_random_uuid()::text, 'Rafael Costa', 'rafael.costa@hotmail.com', '11992002002', false, true, NULL, now() - interval '60 days', now()),
  (gen_random_uuid()::text, 'Bruno Almeida', 'bruno.almeida@gmail.com', '11993003003', false, true, 'Prefere corte degradê', now() - interval '45 days', now()),
  (gen_random_uuid()::text, 'Gustavo Pereira', 'gustavo.p@outlook.com', '11994004004', false, true, NULL, now() - interval '30 days', now()),
  (gen_random_uuid()::text, 'Thiago Rocha', 'thiago.rocha@gmail.com', '11995005005', true, true, 'Tem dívida pendente', now() - interval '75 days', now()),
  (gen_random_uuid()::text, 'Pedro Henrique', 'pedro.h@gmail.com', '11996006006', false, true, NULL, now() - interval '20 days', now()),
  (gen_random_uuid()::text, 'Matheus Lima', 'matheus.lima@yahoo.com', '11997007007', false, true, 'Assinante do plano mensal', now() - interval '50 days', now()),
  (gen_random_uuid()::text, 'Diego Ferreira', 'diego.f@gmail.com', '11998008008', false, true, NULL, now() - interval '15 days', now()),
  (gen_random_uuid()::text, 'Rodrigo Souza', 'rodrigo.souza@gmail.com', '11999009009', true, true, 'Tem dívida antiga', now() - interval '100 days', now()),
  (gen_random_uuid()::text, 'Caio Martins', 'caio.martins@gmail.com', '11990010010', false, true, NULL, now() - interval '10 days', now()),
  (gen_random_uuid()::text, 'Vinícius Barbosa', 'vinicius.b@hotmail.com', '11991011011', false, true, 'Cliente novo', now() - interval '5 days', now()),
  (gen_random_uuid()::text, 'Leonardo Gomes', 'leo.gomes@gmail.com', '11992012012', false, true, NULL, now() - interval '40 days', now()),
  (gen_random_uuid()::text, 'Gabriel Nascimento', 'gabriel.n@gmail.com', '11993013013', false, true, 'Indicado pelo Lucas', now() - interval '25 days', now()),
  (gen_random_uuid()::text, 'Henrique Dias', 'henrique.dias@outlook.com', '11994014014', false, true, NULL, now() - interval '35 days', now()),
  (gen_random_uuid()::text, 'João Paulo', NULL, '11995015015', false, true, 'Sem email cadastrado', now() - interval '8 days', now())
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 4. PRODUTOS
-- ============================================
INSERT INTO products (id, name, description, "costPrice", "salePrice", "minStock", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Pomada Modeladora', 'Pomada matte para cabelo, 150g', 1500, 4500, 5, true, now(), now()),
  (gen_random_uuid()::text, 'Cera Capilar', 'Cera de fixação forte, 100g', 1200, 3500, 5, true, now(), now()),
  (gen_random_uuid()::text, 'Óleo para Barba', 'Óleo hidratante para barba, 30ml', 2000, 5500, 3, true, now(), now()),
  (gen_random_uuid()::text, 'Shampoo Masculino', 'Shampoo anticaspa 300ml', 800, 2500, 10, true, now(), now()),
  (gen_random_uuid()::text, 'Balm para Barba', 'Balm hidratante e modelador, 60g', 1800, 4800, 3, true, now(), now()),
  (gen_random_uuid()::text, 'Pente de Madeira', 'Pente artesanal de madeira', 500, 2000, 8, true, now(), now()),
  (gen_random_uuid()::text, 'Loção Pós-Barba', 'Loção refrescante 100ml', 1000, 3000, 5, true, now(), now()),
  (gen_random_uuid()::text, 'Spray Fixador', 'Spray de fixação média 250ml', 900, 2800, 5, true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. MOVIMENTAÇÕES DE ESTOQUE (entradas iniciais)
-- ============================================
INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 20, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Pomada Modeladora';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 15, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Cera Capilar';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 10, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Óleo para Barba';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 25, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Shampoo Masculino';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 8, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Balm para Barba';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 12, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Pente de Madeira';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 15, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Loção Pós-Barba';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'ENTRY', 18, 'Estoque inicial', now() - interval '30 days', p.id
FROM products p WHERE p.name = 'Spray Fixador';

-- Algumas saídas (vendas)
INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'EXIT', 8, 'Vendas do mês', now() - interval '10 days', p.id
FROM products p WHERE p.name = 'Pomada Modeladora';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'EXIT', 5, 'Vendas do mês', now() - interval '10 days', p.id
FROM products p WHERE p.name = 'Óleo para Barba';

INSERT INTO stock_movements (id, type, quantity, reason, "createdAt", "productId")
SELECT gen_random_uuid()::text, 'EXIT', 3, 'Vendas do mês', now() - interval '10 days', p.id
FROM products p WHERE p.name = 'Cera Capilar';

-- ============================================
-- 6. PLANOS DE ASSINATURA
-- ============================================
INSERT INTO subscription_plans (id, name, description, price, "cutsPerMonth", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Plano Básico', '2 cortes por mês', 7000, 2, true, now(), now()),
  (gen_random_uuid()::text, 'Plano Premium', '4 cortes por mês + barba', 12000, 4, true, now(), now()),
  (gen_random_uuid()::text, 'Plano VIP', 'Cortes ilimitados + barba + sobrancelha', 18000, 8, true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. AGENDAMENTOS (últimos 30 dias + futuros)
-- ============================================
DO $$
DECLARE
  v_prof1_id TEXT;
  v_prof2_id TEXT;
  v_prof3_id TEXT;
  v_prof4_id TEXT;
  v_client_ids TEXT[];
  v_service_corte_id TEXT;
  v_service_barba_id TEXT;
  v_service_combo_id TEXT;
  v_apt_id TEXT;
  v_user_id TEXT;
  v_selected_client TEXT;
  v_selected_prof TEXT;
  v_selected_service TEXT;
  v_price INT;
  v_duration INT;
  v_i INT;
  v_rand FLOAT;
BEGIN
  -- Buscar IDs dos profissionais
  SELECT id INTO v_prof1_id FROM professionals WHERE name = 'Joao Barbeiro' LIMIT 1;
  SELECT id INTO v_prof2_id FROM professionals WHERE name = 'Ricardo Silva' LIMIT 1;
  SELECT id INTO v_prof3_id FROM professionals WHERE name = 'Felipe Santos' LIMIT 1;
  SELECT id INTO v_prof4_id FROM professionals WHERE name = 'André Oliveira' LIMIT 1;

  -- Buscar IDs dos serviços
  SELECT id INTO v_service_corte_id FROM services WHERE name = 'Corte de Cabelo' LIMIT 1;
  SELECT id INTO v_service_barba_id FROM services WHERE name = 'Barba' LIMIT 1;
  SELECT id INTO v_service_combo_id FROM services WHERE name = 'Corte + Barba' LIMIT 1;

  -- Buscar ID do admin
  SELECT id INTO v_user_id FROM users WHERE email = 'admin@barbearia.com' LIMIT 1;

  -- Buscar clientes
  SELECT array_agg(id) INTO v_client_ids FROM clients WHERE "isActive" = true;

  -- Se não temos dados suficientes, sair
  IF v_prof1_id IS NULL OR v_service_corte_id IS NULL OR v_client_ids IS NULL OR array_length(v_client_ids, 1) < 3 THEN
    RAISE NOTICE 'Dados insuficientes para criar agendamentos';
    RETURN;
  END IF;

  -- Criar agendamentos passados (ATTENDED)
  FOR v_i IN 1..30 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_client_ids[1 + floor(random() * array_length(v_client_ids, 1))::int];

    -- Selecionar profissional aleatório
    v_rand := random();
    IF v_rand > 0.75 AND v_prof4_id IS NOT NULL THEN v_selected_prof := v_prof4_id;
    ELSIF v_rand > 0.5 AND v_prof3_id IS NOT NULL THEN v_selected_prof := v_prof3_id;
    ELSIF v_rand > 0.25 AND v_prof2_id IS NOT NULL THEN v_selected_prof := v_prof2_id;
    ELSE v_selected_prof := v_prof1_id;
    END IF;

    -- Selecionar serviço e preço
    v_rand := random();
    IF v_rand > 0.5 THEN
      v_selected_service := v_service_combo_id; v_price := 6500; v_duration := 45;
    ELSIF v_rand > 0.25 THEN
      v_selected_service := v_service_corte_id; v_price := 4500; v_duration := 30;
    ELSE
      v_selected_service := v_service_barba_id; v_price := 3000; v_duration := 20;
    END IF;

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "attendedAt", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      (now() - (v_i || ' days')::interval) + (9 + floor(random() * 8) || ' hours')::interval,
      'ATTENDED'::"AppointmentStatus", v_price, v_duration, true,
      (now() - (v_i || ' days')::interval) + (10 + floor(random() * 8) || ' hours')::interval,
      v_selected_client, v_selected_prof,
      now() - (v_i || ' days')::interval, now() - (v_i || ' days')::interval
    );

    -- Vincular serviço
    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_selected_service, now());

    -- Criar pagamento
    v_rand := random();
    INSERT INTO payments (id, amount, method, "paidAt", "clientId", "registeredBy", "appointmentId", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text, v_price,
      CASE WHEN v_rand > 0.6 THEN 'PIX'::"PaymentMethod" WHEN v_rand > 0.3 THEN 'CASH'::"PaymentMethod" ELSE 'CARD'::"PaymentMethod" END,
      (now() - (v_i || ' days')::interval) + (10 + floor(random() * 8) || ' hours')::interval,
      v_selected_client, v_user_id, v_apt_id,
      now() - (v_i || ' days')::interval, now() - (v_i || ' days')::interval
    );
  END LOOP;

  -- Agendamentos futuros (SCHEDULED)
  FOR v_i IN 1..15 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_client_ids[1 + floor(random() * array_length(v_client_ids, 1))::int];

    v_rand := random();
    IF v_rand > 0.75 AND v_prof4_id IS NOT NULL THEN v_selected_prof := v_prof4_id;
    ELSIF v_rand > 0.5 AND v_prof3_id IS NOT NULL THEN v_selected_prof := v_prof3_id;
    ELSIF v_rand > 0.25 AND v_prof2_id IS NOT NULL THEN v_selected_prof := v_prof2_id;
    ELSE v_selected_prof := v_prof1_id;
    END IF;

    v_rand := random();
    IF v_rand > 0.5 THEN
      v_selected_service := v_service_combo_id; v_price := 6500; v_duration := 45;
    ELSIF v_rand > 0.25 THEN
      v_selected_service := v_service_corte_id; v_price := 4500; v_duration := 30;
    ELSE
      v_selected_service := v_service_barba_id; v_price := 3000; v_duration := 20;
    END IF;

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      (now() + (v_i || ' days')::interval)::date + (9 + floor(random() * 8) || ' hours')::interval + (CASE WHEN random() > 0.5 THEN '30 minutes' ELSE '0 minutes' END)::interval,
      'SCHEDULED'::"AppointmentStatus", v_price, v_duration, false,
      v_selected_client, v_selected_prof, now(), now()
    );

    INSERT INTO appointment_services (id, "appointmentId", "serviceId", "createdAt")
    VALUES (gen_random_uuid()::text, v_apt_id, v_selected_service, now());
  END LOOP;

  -- Cancelados e no-show
  FOR v_i IN 1..5 LOOP
    v_apt_id := gen_random_uuid()::text;
    v_selected_client := v_client_ids[1 + floor(random() * array_length(v_client_ids, 1))::int];

    INSERT INTO appointments (id, "scheduledAt", status, "totalPrice", "totalDuration", "isPaid", "canceledAt", "clientId", "professionalId", "createdAt", "updatedAt")
    VALUES (
      v_apt_id,
      now() - ((5 + v_i) || ' days')::interval + '14 hours'::interval,
      CASE WHEN v_i <= 3 THEN 'CANCELED'::"AppointmentStatus" ELSE 'NO_SHOW'::"AppointmentStatus" END,
      4500, 30, false,
      CASE WHEN v_i <= 3 THEN now() - ((5 + v_i) || ' days')::interval ELSE NULL END,
      v_selected_client, v_prof1_id,
      now() - ((5 + v_i) || ' days')::interval, now() - ((5 + v_i) || ' days')::interval
    );
  END LOOP;

END $$;

-- ============================================
-- 8. DÍVIDAS
-- ============================================
INSERT INTO debts (id, amount, "amountPaid", "remainingBalance", description, "dueDate", "isSettled", "clientId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, 6500, 0, 6500, 'Corte + Barba não pago',
  now() + interval '7 days', false,
  c.id, now() - interval '5 days', now()
FROM clients c WHERE c.name = 'Thiago Rocha' LIMIT 1;

INSERT INTO debts (id, amount, "amountPaid", "remainingBalance", description, "dueDate", "isSettled", "clientId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, 13000, 4500, 8500, 'Dois cortes + barba pendentes',
  now() - interval '3 days', false,
  c.id, now() - interval '20 days', now()
FROM clients c WHERE c.name = 'Rodrigo Souza' LIMIT 1;

INSERT INTO debts (id, amount, "amountPaid", "remainingBalance", description, "dueDate", "isSettled", "clientId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, 4500, 4500, 0, 'Corte pago com atraso',
  now() - interval '15 days', true,
  c.id, now() - interval '25 days', now()
FROM clients c WHERE c.name = 'Lucas Mendes' LIMIT 1;

-- ============================================
-- 9. ASSINATURAS DE CLIENTES
-- ============================================
INSERT INTO client_subscriptions (id, status, "startDate", "endDate", "cutsUsedThisMonth", "lastResetDate", "clientId", "planId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, 'ACTIVE', now() - interval '10 days', now() + interval '20 days', 1,
  now() - interval '10 days',
  c.id, sp.id, now() - interval '10 days', now()
FROM clients c, subscription_plans sp
WHERE c.name = 'Matheus Lima' AND sp.name = 'Plano Premium'
LIMIT 1;

INSERT INTO client_subscriptions (id, status, "startDate", "endDate", "cutsUsedThisMonth", "lastResetDate", "clientId", "planId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, 'ACTIVE', now() - interval '5 days', now() + interval '25 days', 0,
  now() - interval '5 days',
  c.id, sp.id, now() - interval '5 days', now()
FROM clients c, subscription_plans sp
WHERE c.name = 'Lucas Mendes' AND sp.name = 'Plano VIP'
LIMIT 1;

-- ============================================
-- 10. CATEGORIAS FINANCEIRAS
-- ============================================
INSERT INTO financial_categories (id, name, type, "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Serviços', 'REVENUE', true, now(), now()),
  (gen_random_uuid()::text, 'Vendas de Produtos', 'REVENUE', true, now(), now()),
  (gen_random_uuid()::text, 'Assinaturas', 'REVENUE', true, now(), now()),
  (gen_random_uuid()::text, 'Aluguel', 'EXPENSE', true, now(), now()),
  (gen_random_uuid()::text, 'Fornecedores', 'EXPENSE', true, now(), now()),
  (gen_random_uuid()::text, 'Energia/Água', 'EXPENSE', true, now(), now()),
  (gen_random_uuid()::text, 'Marketing', 'EXPENSE', true, now(), now()),
  (gen_random_uuid()::text, 'Manutenção', 'EXPENSE', true, now(), now()),
  (gen_random_uuid()::text, 'Comissões', 'EXPENSE', true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. TRANSAÇÕES FINANCEIRAS
-- ============================================
INSERT INTO financial_transactions (id, type, description, amount, discount, interest, "netAmount", "paymentCondition", status, "dueDate", "paidAt", "categoryId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', 'Aluguel do mês', 350000, 0, 0, 350000, 'A_VISTA', 'PAID',
  (date_trunc('month', now()))::timestamp, (date_trunc('month', now()) + interval '5 days')::timestamp,
  fc.id, now() - interval '20 days', now()
FROM financial_categories fc WHERE fc.name = 'Aluguel' LIMIT 1;

INSERT INTO financial_transactions (id, type, description, amount, discount, interest, "netAmount", "paymentCondition", status, "dueDate", "categoryId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', 'Compra de produtos - Fornecedor X', 45000, 5, 0, 42750, 'A_PRAZO', 'PENDING',
  (now() + interval '15 days')::timestamp,
  fc.id, now() - interval '5 days', now()
FROM financial_categories fc WHERE fc.name = 'Fornecedores' LIMIT 1;

INSERT INTO financial_transactions (id, type, description, amount, discount, interest, "netAmount", "paymentCondition", status, "dueDate", "paidAt", "categoryId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', 'Conta de energia', 85000, 0, 0, 85000, 'A_VISTA', 'PAID',
  (now() - interval '10 days')::timestamp, (now() - interval '8 days')::timestamp,
  fc.id, now() - interval '15 days', now()
FROM financial_categories fc WHERE fc.name = 'Energia/Água' LIMIT 1;

INSERT INTO financial_transactions (id, type, description, amount, discount, interest, "netAmount", "paymentCondition", status, "dueDate", "categoryId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', 'Anúncio Instagram', 20000, 0, 0, 20000, 'A_VISTA', 'PENDING',
  (now() + interval '5 days')::timestamp,
  fc.id, now() - interval '2 days', now()
FROM financial_categories fc WHERE fc.name = 'Marketing' LIMIT 1;

INSERT INTO financial_transactions (id, type, description, amount, discount, interest, "netAmount", "paymentCondition", status, "dueDate", "paidAt", "categoryId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSE', 'Manutenção do ar condicionado', 15000, 0, 0, 15000, 'A_VISTA', 'PAID',
  (now() - interval '5 days')::timestamp, (now() - interval '5 days')::timestamp,
  fc.id, now() - interval '7 days', now()
FROM financial_categories fc WHERE fc.name = 'Manutenção' LIMIT 1;

-- ============================================
-- 12. CAIXA (últimos dias)
-- ============================================
INSERT INTO cash_registers (id, date, "openedAt", "openingBalance", "closedAt", "closingBalance", "totalCash", "totalPix", "totalCard", "totalRevenue", discrepancy, "isOpen", "openedBy", "closedBy", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  (now() - interval '2 days')::date,
  (now() - interval '2 days')::date + '09:00'::time,
  10000,
  (now() - interval '2 days')::date + '18:00'::time,
  38500,
  18500, 15000, 12000, 45500, -500, false,
  u.id, u.id, now() - interval '2 days', now() - interval '2 days'
FROM users u WHERE u.email = 'admin@barbearia.com' LIMIT 1;

INSERT INTO cash_registers (id, date, "openedAt", "openingBalance", "closedAt", "closingBalance", "totalCash", "totalPix", "totalCard", "totalRevenue", discrepancy, "isOpen", "openedBy", "closedBy", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  (now() - interval '1 day')::date,
  (now() - interval '1 day')::date + '09:00'::time,
  10000,
  (now() - interval '1 day')::date + '18:00'::time,
  42000,
  22000, 18000, 14000, 54000, 0, false,
  u.id, u.id, now() - interval '1 day', now() - interval '1 day'
FROM users u WHERE u.email = 'admin@barbearia.com' LIMIT 1;

-- Caixa de hoje (aberto)
INSERT INTO cash_registers (id, date, "openedAt", "openingBalance", "isOpen", "openedBy", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  now()::date,
  now()::date + '09:00'::time,
  10000, true,
  u.id, now(), now()
FROM users u WHERE u.email = 'admin@barbearia.com' LIMIT 1;

-- ============================================
-- 13. COMISSÕES
-- ============================================
DO $$
DECLARE
  v_prof_id TEXT;
BEGIN
  FOR v_prof_id IN SELECT id FROM professionals WHERE "isActive" = true LOOP
    -- Comissão mês passado (paga)
    INSERT INTO commissions (id, amount, "periodStart", "periodEnd", status, "paidAt", "professionalId", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      15000 + floor(random() * 20000)::int,
      date_trunc('month', now() - interval '1 month'),
      date_trunc('month', now()) - interval '1 second',
      'PAID'::"CommissionStatus",
      date_trunc('month', now()) + interval '5 days',
      v_prof_id,
      date_trunc('month', now()) + interval '5 days',
      date_trunc('month', now()) + interval '5 days'
    );

    -- Comissão mês atual (pendente)
    INSERT INTO commissions (id, amount, "periodStart", "periodEnd", status, "professionalId", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      10000 + floor(random() * 15000)::int,
      date_trunc('month', now()),
      now(),
      'PENDING'::"CommissionStatus",
      v_prof_id,
      now(),
      now()
    );
  END LOOP;
END $$;

-- ============================================
-- FIM DOS DADOS DE EXEMPLO
-- ============================================
