# Backend - Sistema de Gestão de Barbearia

Backend NestJS para sistema de gestão de barbearia pequena.

## Arquitetura

Arquitetura modular baseada em domínios (Domain-Driven Design simplificado).
Cada módulo é independente e responsável por uma área específica do negócio.

## Estrutura de Pastas

```
backend/
├── src/
│   ├── main.ts              # Entry point da aplicação
│   ├── app.module.ts        # Módulo raiz
│   ├── common/              # Recursos compartilhados
│   │   └── enums/           # Enums globais
│   ├── users/               # Gestão de usuários (admin, profissional)
│   ├── clients/             # Gestão de clientes
│   ├── professionals/       # Gestão de profissionais (barbeiros)
│   ├── services/            # Catálogo de serviços
│   ├── appointments/        # Agendamentos
│   ├── payments/            # Registro de pagamentos
│   ├── debts/               # Controle de fiado
│   └── cash-register/       # Caixa diário
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Módulos do Sistema

### 1. Users (`users/`)
Gerencia usuários do sistema (ADMIN e PROFESSIONAL).
- Autenticação e autorização
- Acesso ao painel administrativo
- Profissionais podem ter conta vinculada

### 2. Clients (`clients/`)
Gerencia clientes que agendam serviços.
- Registro via app (email/senha ou Google)
- Perfil e histórico
- Tracking de dívidas

### 3. Professionals (`professionals/`)
Gerencia barbeiros que prestam serviços.
- Horários de trabalho
- Serviços que realiza
- Disponibilidade para agendamentos

### 4. Services (`services/`)
Catálogo de serviços oferecidos.
- Nome, descrição, preço, duração
- Usado para cálculo de agendamentos

### 5. Appointments (`appointments/`)
Gestão de agendamentos.
- Status: SCHEDULED, ATTENDED, CANCELED, NO_SHOW
- **IMPORTANTE**: Atendimento ≠ Pagamento
- Um agendamento pode estar ATTENDED mas NÃO PAGO

### 6. Payments (`payments/`)
**Registro manual de pagamentos (NÃO processamento)**.
- Métodos: CASH, PIX, CARD (apenas tracking)
- Sistema NÃO integra com gateways
- Sistema NÃO processa pagamentos
- Pagamentos registrados manualmente pela equipe

### 7. Debts (`debts/`)
Controle de fiado (dívidas).
- Independente da forma de pagamento
- Suporta pagamentos parciais
- Tracking de clientes devedores

### 8. Cash Register (`cash-register/`)
Controle de caixa diário.
- Abertura e fechamento
- Totalização por método de pagamento
- Controle de discrepâncias

## Regras de Negócio Críticas

1. **Atendimento ≠ Pagamento**
   - Appointment pode estar ATTENDED mas isPaid = false
   - São conceitos separados no domínio

2. **Sistema NÃO processa pagamentos**
   - Apenas registra manualmente
   - PaymentMethod é para tracking, não processamento
   - Sem integração com Stripe neste escopo

3. **Dívidas são independentes**
   - Não dependem da forma de pagamento
   - Cliente pode ter múltiplas dívidas
   - Suportam pagamentos parciais

4. **Escopo fechado**
   - Sem multi-unidade
   - Sem mensalidade
   - Barbearia pequena

## Setup do Projeto

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar banco de dados

Criar arquivo `.env` na raiz do backend (use `.env.example` como base):

```bash
cp .env.example .env
```

Editar `.env` com suas credenciais do PostgreSQL:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/barbearia_db?schema=public"
```

### 3. Executar migrations

```bash
npm run prisma:migrate
```

Este comando:
- Cria o banco de dados se não existir
- Cria todas as tabelas
- Gera o Prisma Client

### 4. (Opcional) Visualizar banco com Prisma Studio

```bash
npm run prisma:studio
```

Abre interface web em `http://localhost:5555` para visualizar e editar dados.

## Próximos Passos

1. ✅ ~~Instalar dependências~~
2. ✅ ~~Implementar camada de persistência (Prisma)~~
3. Criar controllers para cada módulo
4. Implementar autenticação (JWT)
5. Adicionar validação de DTOs (class-validator)
6. Criar seeds para dados iniciais
7. Criar testes unitários e e2e

## Comandos

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run start:dev

# Build
npm run build

# Produção
npm run start:prod
```
