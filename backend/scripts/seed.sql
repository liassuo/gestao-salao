-- Admin user
INSERT INTO users (id, email, name, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@barbearia.com',
  'Admin',
  '$2b$10$XYDbgGrYkMCvNVQAIIWWB.H1GawS1vj18akj7MW7zRQCCSdmfuTD.',
  'ADMIN',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Servicos
INSERT INTO services (id, name, description, price, duration, "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Corte de Cabelo', 'Corte masculino tradicional', 4500, 30, true, now(), now()),
  (gen_random_uuid(), 'Barba', 'Aparar e modelar barba', 3000, 20, true, now(), now()),
  (gen_random_uuid(), 'Corte + Barba', 'Combo corte e barba', 6500, 45, true, now(), now())
ON CONFLICT DO NOTHING;

-- Profissional
INSERT INTO professionals (id, name, phone, email, "commissionRate", "workingHours", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Joao Barbeiro',
  '11999999999',
  'joao@barbearia.com',
  50.00,
  '[{"dayOfWeek":1,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":2,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":3,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":4,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":5,"startTime":"09:00","endTime":"18:00"},{"dayOfWeek":6,"startTime":"09:00","endTime":"14:00"}]',
  true,
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- Cliente exemplo
INSERT INTO clients (id, name, email, phone, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Carlos Cliente', 'carlos@email.com', '11988888888', true, now(), now())
ON CONFLICT (email) DO NOTHING;
