# Sistema de Gestao de Barbearia

![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.1-06b6d4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2-646cff?logo=vite&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2d3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/Licenca-Privado-red)

Sistema web completo para gestao de barbearias e saloes de beleza, com agendamentos, estoque, comandas, financeiro, caixa diario, dividas (fiado) e dashboard analitico. Monorepo com frontend React e backend NestJS, ambos em TypeScript.

---

## Funcionalidades

### Agendamentos
- **Calendario visual** por profissional com bloqueio de horarios
- **Status de atendimento**: agendado, atendido, cancelado, nao compareceu
- **Multiplos servicos** por agendamento com calculo automatico de preco e duracao
- **Atendimento independente de pagamento** (pode atender sem pagar na hora)

### Clientes
- Cadastro com telefone e email opcional
- Historico de agendamentos, pagamentos e dividas
- Planos de assinatura (ex: cortes mensais ilimitados)

### Profissionais
- Perfil com taxa de comissao configuravel
- Horarios de trabalho por dia da semana
- Bloqueio de horarios (ferias, folgas)
- Vinculacao com conta de usuario do sistema

### Servicos e Produtos
- **Catalogo de servicos** com preco e duracao
- **Catalogo de produtos** com preco de custo e venda
- **Estoque minimo** com alertas de reposicao

### Comandas (Orders)
- Criacao de comandas com itens (produtos e/ou servicos)
- Selecao de cliente e profissional
- Adicionar/remover itens com recalculo automatico
- Integracao com estoque (baixa automatica de produtos)
- Status: pendente, paga, cancelada

### Estoque
- **Movimentacoes** de entrada e saida com historico
- **Estoque atual** calculado por produto
- **Alertas** de estoque baixo (abaixo do minimo)
- **Busca e filtros** nas tabelas

### Caixa Diario
- Abertura e fechamento de caixa com saldo inicial
- Totalizacao por forma de pagamento (dinheiro, PIX, cartao)
- Receita total do dia e deteccao de divergencias
- Restricao de um caixa por dia

### Pagamentos
- **Registro manual** (sem gateway de pagamento)
- Formas: dinheiro, PIX, cartao
- Um pagamento por agendamento
- Vinculacao com caixa diario

### Dividas (Fiado)
- Registro de dividas independente de forma de pagamento
- Pagamentos parciais com saldo restante
- Controle de vencimento e quitacao

### Modulo Financeiro
- **Contas a pagar e receber** com status (pendente, pago, vencido, cancelado)
- **Categorias hierarquicas** (categoria + subcategoria) para despesas e receitas
- **Formas de pagamento configuraveis** (a vista / a prazo, escopo comanda / despesa)
- **Contas bancarias** para vincular transacoes
- **Desconto e juros** com calculo de valor liquido
- **Comissoes** por profissional com periodo e status de pagamento

### Multi-filial
- Cadastro de filiais
- Estoque, transacoes e comissoes por filial

### Dashboard e Relatorios
- **Dashboard operacional**: top clientes, estoque baixo, inadimplentes
- **Dashboard estrategico**: faturamento, ocupacao, planos ativos
- **Graficos** com Recharts
- **Relatorios** consolidados

### Assinaturas
- Planos com limite de cortes por mes
- Status: ativa, cancelada, expirada, suspensa
- Controle de uso mensal

---

## Arquitetura

```
gestao-salao/
├── frontend/          # React 19 + Vite + Tailwind CSS
├── backend/           # NestJS 10 + Prisma + PostgreSQL
└── package.json
```

---

## Pre-requisitos

- [Node.js](https://nodejs.org/) >= 18.x
- [npm](https://www.npmjs.com/) >= 9.x
- [PostgreSQL](https://www.postgresql.org/) >= 14.x

## Instalacao

```bash
# Clonar o repositorio
git clone <url-do-repositorio>
cd gestao-salao

# Instalar dependencias do backend
cd backend
npm install

# Instalar dependencias do frontend
cd ../frontend
npm install
```

## Configuracao

### Backend

Crie `backend/.env` a partir do exemplo:

```bash
cp backend/.env.example backend/.env
```

Edite com suas credenciais:

```env
# Banco de dados
DATABASE_URL="postgresql://user:password@localhost:5432/gestao_barbearia?schema=public"

# JWT
JWT_SECRET="sua-chave-secreta-altere-em-producao"
JWT_EXPIRES_IN="24h"
```

### Banco de dados

```bash
cd backend

# Gerar Prisma Client
npm run prisma:generate

# Executar migrations
npm run prisma:migrate

# (Opcional) Popular dados iniciais
npm run prisma:seed

# (Opcional) Abrir Prisma Studio (GUI do banco)
npm run prisma:studio
```

## Executando

```bash
# Backend (http://localhost:3000)
cd backend
npm run start:dev

# Frontend (http://localhost:5173)
cd frontend
npm run dev
```

## Build & Deploy

```bash
# Build backend
cd backend
npm run build
npm run start:prod

# Build frontend (gera dist/ estatico)
cd frontend
npm run build
npm run preview    # Visualizar build localmente
```

## Testes

```bash
# Backend
cd backend
npm test                # Testes unitarios (Jest)
npm run test:watch      # Watch mode
npm run test:cov        # Com cobertura

# Lint e formatacao
npm run lint
npm run format
```

---

## Frontend

### Estrutura

```
frontend/src/
├── app/                    # Componente App principal
├── pages/                  # 25+ paginas
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Appointments.tsx
│   ├── Clients.tsx
│   ├── Professionals.tsx
│   ├── Services.tsx
│   ├── Products.tsx
│   ├── Orders.tsx              # Comandas
│   ├── StockCurrent.tsx
│   ├── StockMovements.tsx
│   ├── CashRegister.tsx
│   ├── Payments.tsx
│   ├── Debts.tsx
│   ├── Subscriptions.tsx
│   ├── Reports.tsx
│   ├── Settings.tsx
│   ├── BarKitchen.tsx          # Tela bar/cozinha
│   ├── AccountsPayable.tsx     # Contas a pagar
│   ├── AccountsReceivable.tsx  # Contas a receber
│   ├── Balance.tsx             # Balanco
│   ├── Branches.tsx
│   ├── BankAccounts.tsx
│   ├── Commissions.tsx
│   ├── FinancialCategories.tsx
│   └── PaymentMethods.tsx
├── components/             # Componentes reutilizaveis
├── services/               # Camada de API (Axios)
├── hooks/                  # Hooks customizados (React Query)
├── contexts/               # AuthContext
├── types/                  # Definicoes TypeScript
├── config/                 # Configuracao
├── auth/                   # Utilitarios de autenticacao
├── utils/                  # Utilitarios gerais
├── styles/                 # Estilos globais
└── client/                 # Setup do cliente API
```

### Principais Bibliotecas

| Biblioteca | Uso |
|---|---|
| **React 19** | Framework UI |
| **Vite 7** | Build tool com HMR |
| **Tailwind CSS 4** | Estilizacao utility-first |
| **React Query** (TanStack) | Cache e estado do servidor |
| **React Hook Form** | Formularios |
| **React Router DOM 7** | Roteamento SPA |
| **Axios** | Cliente HTTP com interceptors |
| **Recharts 3** | Graficos e visualizacoes |
| **Lucide React** | Icones SVG |

---

## Backend

### Estrutura

```
backend/src/
├── main.ts                      # Bootstrap NestJS (porta 3000)
├── app.module.ts                # Registro de todos os modulos
├── auth/                        # JWT + Passport (login, guards, decorators)
├── users/                       # CRUD de usuarios (admin/profissional)
├── clients/                     # CRUD de clientes
├── professionals/               # CRUD de profissionais + horarios
├── services/                    # Catalogo de servicos
├── appointments/                # Agendamentos + calendario + bloqueio
├── payments/                    # Registro manual de pagamentos
├── debts/                       # Dividas (fiado) com pagamento parcial
├── cash-register/               # Caixa diario (abertura/fechamento)
├── orders/                      # Comandas (produtos + servicos)
├── products/                    # CRUD de produtos
├── stock/                       # Movimentacoes e estoque atual
├── dashboard/                   # Metricas operacionais e estrategicas
├── reports/                     # Relatorios consolidados
├── subscriptions/               # Planos de assinatura
├── branches/                    # Filiais
├── bank-accounts/               # Contas bancarias
├── commissions/                 # Comissoes de profissionais
├── financial-transactions/      # Transacoes financeiras (despesa/receita)
├── financial-categories/        # Categorias hierarquicas
├── payment-method-config/       # Configuracao de formas de pagamento
├── common/                      # Enums e utilitarios compartilhados
└── prisma/                      # Prisma service e seed
```

### Documentacao Swagger

Disponivel em `http://localhost:3000/api/docs` com todos os endpoints documentados.

### Principais Endpoints

#### Autenticacao (`/auth`)
| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/auth/login` | Login com email/senha |

#### Usuarios (`/users`)
| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/users` | Listar usuarios |
| POST | `/users` | Criar usuario |
| GET | `/users/:id` | Detalhes do usuario |
| PATCH | `/users/:id` | Atualizar usuario |
| DELETE | `/users/:id` | Remover usuario |

#### Clientes (`/clients`)
| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/clients` | Listar clientes |
| POST | `/clients` | Criar cliente |
| GET | `/clients/:id` | Detalhes do cliente |
| PATCH | `/clients/:id` | Atualizar cliente |
| DELETE | `/clients/:id` | Remover cliente |

#### Agendamentos (`/appointments`)
| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/appointments` | Listar agendamentos |
| POST | `/appointments` | Criar agendamento |
| GET | `/appointments/:id` | Detalhes |
| PATCH | `/appointments/:id` | Atualizar |
| PATCH | `/appointments/:id/attend` | Marcar como atendido |
| PATCH | `/appointments/:id/cancel` | Cancelar |
| GET | `/appointments/calendar/:professionalId` | Calendario por profissional |

#### Servicos, Produtos, Pagamentos, Dividas, Caixa, Comandas, Estoque
Todos seguem o padrao RESTful com CRUD completo.

---

## Banco de Dados

### Modelos principais (Prisma)

| Grupo | Modelos |
|---|---|
| **Usuarios** | `User` (admin, profissional) |
| **Clientes** | `Client`, `ClientSubscription`, `SubscriptionPlan` |
| **Profissionais** | `Professional`, `TimeBlock`, `Commission` |
| **Servicos** | `Service`, `AppointmentService` |
| **Agendamentos** | `Appointment` |
| **Pagamentos** | `Payment`, `Debt`, `CashRegister` |
| **Estoque** | `Product`, `StockMovement` |
| **Comandas** | `Order`, `OrderItem` |
| **Financeiro** | `FinancialTransaction`, `FinancialCategory`, `BankAccount`, `PaymentMethodConfig` |
| **Filiais** | `Branch` |

### Niveis de Acesso

| Papel | Acesso |
|---|---|
| **ADMIN** | Acesso total: usuarios, configuracoes, financeiro, relatorios |
| **PROFESSIONAL** | Agendamentos, atendimentos, comandas vinculados ao profissional |

### Regras de Negocio Importantes

1. **Atendimento != Pagamento** - cliente pode ser atendido sem pagar na hora
2. **Sem gateway de pagamento** - registros manuais apenas (dinheiro, PIX, cartao)
3. **Dividas independentes** - fiado nao depende de forma de pagamento, aceita pagamentos parciais
4. **Um caixa por dia** - apenas um registro de caixa pode existir por data
5. **Valores em centavos** - todos os valores monetarios sao armazenados em centavos (5000 = R$ 50,00)
6. **Comandas integradas** - ao pagar uma comanda, o estoque e o caixa sao atualizados automaticamente

---

## Seguranca

- **JWT** com Passport strategies para autenticacao
- **bcrypt** para hash de senhas
- **Guards de rota** por papel no frontend e backend
- **class-validator** para validacao de DTOs
- **CORS** habilitado no backend
- **Swagger** protegido em producao

---

## Stack Tecnica

| Componente | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 |
| Backend | NestJS 10 + TypeScript 5 |
| ORM | Prisma 5 |
| Banco de dados | PostgreSQL |
| Autenticacao | JWT + Passport |
| Validacao | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI |
| Graficos | Recharts |
| Estado servidor | TanStack React Query |
| Formularios | React Hook Form |
