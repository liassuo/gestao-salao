# Prisma Schema - Sistema de Gestão de Barbearia

Este arquivo documenta decisões de modelagem e regras importantes do banco de dados.

## Banco de Dados

- **SGBD**: PostgreSQL
- **ORM**: Prisma

## Decisões de Modelagem

### 1️⃣ Client.email é opcional

```prisma
email String? @unique
```

**Por quê?**
- Em barbearia pequena, muitos clientes não têm email
- Cliente pode se cadastrar apenas com nome e telefone
- Email obrigatório apenas para login por email/senha ou Google OAuth

**Implicação**: Validar no backend se email é fornecido quando necessário para autenticação.

---

### 2️⃣ Client.hasDebts é campo derivável

```prisma
hasDebts Boolean @default(false)
```

**Por quê mantemos?**
- Performance: Evita query em `debts` toda vez
- UX: Marcação visual rápida no sistema

**CUIDADO**:
- Este é um campo calculado
- **SEMPRE** atualizar quando:
  - Nova dívida criada → `hasDebts = true`
  - Todas dívidas quitadas → `hasDebts = false`
- Pode ficar inconsistente se esquecer de atualizar
- Considerar trigger no banco ou método auxiliar no service

**Alternativa purista**: Remover campo e calcular em tempo real com query.

---

### 3️⃣ Payment.appointmentId é @unique

```prisma
appointmentId String? @unique
```

**Por quê?**
- No escopo atual: **1 agendamento = 1 pagamento máximo**
- Não há parcelamento
- Não há pagamentos múltiplos

**Quando remover @unique?**
- Se implementar parcelamento (ex: entrada + restante)
- Se permitir pagamentos parciais em datas diferentes

**Para o futuro**: Se remover `@unique`, implementar lógica de soma de pagamentos por appointment.

---

### 4️⃣ CashRegister.date é @unique e normalizado

```prisma
date DateTime @unique @db.Date
```

**Por quê?**
- Apenas **1 caixa por dia**
- Evita caixas duplicados

**IMPORTANTE NO CÓDIGO**:
```typescript
// Sempre normalizar para início do dia (00:00:00)
const normalizedDate = new Date(date.setHours(0, 0, 0, 0));
```

**Validações necessárias**:
- Não permitir abrir caixa se já existe um aberto
- Não permitir abrir caixa com data que já existe (fechada)

---

## Relacionamentos Importantes

### Appointment ↔ Payment (1:1 opcional)

```prisma
model Appointment {
  payment Payment?
}

model Payment {
  appointmentId String? @unique
  appointment   Appointment?
}
```

- Appointment pode existir sem Payment (não pago)
- Payment pode existir sem Appointment (pagamento de dívida avulso)
- Quando vinculados, é relação 1:1

### Appointment ↔ Service (N:N)

```prisma
model AppointmentService {
  appointmentId String
  serviceId     String
  @@unique([appointmentId, serviceId])
}
```

- Um agendamento pode ter múltiplos serviços
- Permite combinações (corte + barba)
- Tabela intermediária para N:N

### Client ↔ Debt (1:N)

```prisma
model Client {
  debts Debt[]
}

model Debt {
  clientId String
  client   Client
}
```

- Cliente pode ter múltiplas dívidas
- Dívidas são independentes da forma de pagamento
- Suportam pagamentos parciais (amountPaid)

---

## Regras de Negócio no Banco

### ✅ O que o schema garante:

1. **Email único** (quando fornecido)
2. **GoogleId único** (quando fornecido)
3. **1 Professional por User** (relation 1:1)
4. **1 CashRegister por dia** (date @unique)
5. **Deleção em cascata** de AppointmentService quando Appointment deletado

### ⚠️ O que DEVE ser validado no código:

1. Normalizar `CashRegister.date` para 00:00:00
2. Atualizar `Client.hasDebts` quando debts mudar
3. Calcular `totalPrice` e `totalDuration` ao criar Appointment
4. Calcular `remainingBalance` ao criar ou atualizar Debt
5. Validar disponibilidade de profissional antes de criar Appointment
6. Impedir abrir CashRegister se já existe um aberto

---

## Setup Inicial

```bash
# Instalar Prisma
npm install prisma @prisma/client

# Criar migration inicial
npx prisma migrate dev --name init

# Gerar Prisma Client
npx prisma generate

# (Opcional) Abrir Prisma Studio
npx prisma studio
```

## Variável de Ambiente

Criar `.env` na raiz do backend:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/barbearia_db?schema=public"
```

---

## Próximos Passos

1. [ ] Criar arquivo `.env` com DATABASE_URL
2. [ ] Executar `npx prisma migrate dev --name init`
3. [ ] Atualizar services para usar Prisma Client
4. [ ] Implementar validações de negócio mencionadas acima
5. [ ] Criar seeds para dados iniciais (admin user, serviços básicos)
