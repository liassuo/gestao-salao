# Roteiro de Verificacao - Gestao Salao

## FASE 1 — SETUP INICIAL (Admin)

### 1.1 Login e primeiro acesso
- [X] Abra /login no navegador
- [X] Tente logar com senha errada → mensagem de erro aparece
- [X] Logue com credenciais corretas → vai pro Dashboard
- [X] Dashboard carrega sem erros (pode estar vazio, tudo bem)

### 1.2 Configurar o negocio
- [X] Va em Configuracoes (/configuracoes)
- [X] Preencha: nome do salao, telefone, WhatsApp, endereco
- [X] Configure horario de abertura e fechamento
- [X] Configure duracao do slot (ex: 30 min)
- [X] Salve → toast de sucesso
- [X] Recarregue a pagina → dados persistiram

### 1.3 Configurar aparencia
- [X] Troque para Tema Escuro → UI muda na hora
- [X] Troque para Tema Claro → UI muda na hora
- [X] Troque a cor de destaque → UI atualiza
- [X] Deixe no tema que preferir

### 1.4 Cadastrar uma filial
- [X] Va em Financeiro > Filiais (/financeiro/filiais)
- [X] Crie a filial principal (nome, endereco)
- [X] Filial aparece na lista

### 1.5 Configurar formas de pagamento
- [X] Va em Financeiro > Formas de Pagamento (/financeiro/formas-pagamento)
- [X] Crie "Dinheiro" (A_VISTA, escopo AMBOS)
- [X] Crie "PIX" (A_VISTA, escopo AMBOS)
- [X] Crie "Cartao" (A_VISTA, escopo AMBOS)
- [X] As 3 aparecem na lista

---

## FASE 2 — CADASTROS BASE

### 2.1 Cadastrar servicos
- [X] Va em Servicos (/servicos)
- [X] Crie "Corte Masculino" — R$ 45,00 — 30 min
- [X] Crie "Barba" — R$ 25,00 — 20 min
- [X] Crie "Corte + Barba" — R$ 60,00 — 45 min
- [X] Os 3 servicos aparecem na lista com preco em R$ e duracao em minutos
- [X] Edite o preco de um deles → salva ok
- [X] Desfaca a edicao (volte ao preco original)

### 2.2 Cadastrar profissionais
- [X] Va em Profissionais (/profissionais)
- [X] Crie "Joao" — comissao 40% — associe a filial criada
- [X] Configure horarios de trabalho do Joao (seg-sab, 9h-18h por ex.)
- [X] Associe os servicos ao Joao
- [X] Crie "Maria" — comissao 35% — mesma filial
- [X] Configure horarios e servicos da Maria
- [X] Ambos aparecem na lista

### 2.3 Cadastrar clientes (pelo admin)
- [X] Va em Clientes (/clientes)
- [X] Crie "Carlos Silva" — telefone e email
- [X] Crie "Ana Santos" — telefone, sem email
- [X] Ambos aparecem na lista
- [X] Use a busca → encontra por nome
- [X] Edite o telefone do Carlos → salva ok

### 2.4 Cadastrar produtos
- [X] Va em Estoque > Produtos (/estoque/produtos)
- [X] Crie "Pomada Modeladora" — custo R$ 15, venda R$ 35, estoque min 5
- [X] Crie "Shampoo Especial" — custo R$ 20, venda R$ 45, estoque min 3
- [X] Ambos aparecem na lista

### 2.5 Dar entrada no estoque
- [X] Va em Estoque > Movimentacoes (/estoque/movimentacoes)
- [X] Crie ENTRADA: 20 unidades de Pomada Modeladora
- [X] Crie ENTRADA: 10 unidades de Shampoo Especial
- [X] Va em Estoque > Atual (/estoque/atual) → quantidades corretas
- [X] Valores totais calculados corretamente

---

## FASE 3 — PROMOCAO E ASSINATURA

### 3.1 Criar uma promocao
- [X] Va em Promocoes (/promocoes)
- [X] Crie "Inauguracao" — 20% desconto — servico "Corte Masculino"
- [X] Data inicio: hoje, data fim: daqui 7 dias
- [X] Status aparece como ATIVA
- [X] Crie uma segunda promocao como TEMPLATE para uso futuro
- [X] Template aparece na aba Templates
- [X] Clone a promocao ativa → copia criada

### 3.2 Criar plano de assinatura
- [X] Va em Assinaturas (/assinaturas)
- [X] Na aba Planos, crie "Plano Mensal" — R$ 120 — 4 cortes/mes
- [X] Plano aparece na lista

### 3.3 Inscrever cliente no plano
- [X] Na aba Assinaturas, inscreva "Carlos Silva" no "Plano Mensal"
- [X] Assinatura aparece como ATIVA
- [X] Cortes usados: 0/4

---

## FASE 4 — FLUXO PRINCIPAL: AGENDAMENTO PELO ADMIN

### 4.1 Abrir o caixa do dia
- [X] Va em Caixa (/caixa)
- [X] Abra o caixa com saldo inicial (ex: R$ 100,00)
- [X] Status muda para ABERTO

### 4.2 Criar agendamento pelo admin
- [X] Va em Agendamentos (/agendamentos)
- [X] Crie um agendamento: Carlos Silva + Joao + Corte Masculino + hoje 14h
- [X] Agendamento aparece na lista como AGENDADO
- [X] Mude para visualizacao de calendario → agendamento visivel
- [X] Volte ao Dashboard → agendamento aparece em "Agendamentos de Hoje"

### 4.3 Criar bloqueio de horario
- [ ] Volte em Agendamentos
- [ ] Crie um bloqueio para Joao hoje das 16h-17h
- [ ] Tente criar agendamento nesse horario → nao deve permitir
- [ ] Delete o bloqueio → horario liberado novamente

### 4.4 Atender o agendamento
- [ ] Encontre o agendamento do Carlos
- [ ] Marque como COMPARECEU
- [ ] Status muda para COMPARECEU

### 4.5 Registrar pagamento
- [ ] Va em Pagamentos (/pagamentos)
- [ ] Crie pagamento: Carlos, R$ 45,00, metodo DINHEIRO, vincule ao agendamento
- [ ] Pagamento aparece na lista
- [ ] Volte ao Dashboard → receita atualizada, atividade recente mostra o pagamento

### 4.6 Segundo agendamento — testar nao comparecimento
- [ ] Crie agendamento: Ana Santos + Maria + Barba + hoje 15h
- [ ] Marque como NAO COMPARECEU
- [ ] Status muda para NAO COMPARECEU

### 4.7 Terceiro agendamento — testar cancelamento
- [ ] Crie agendamento: Carlos + Joao + Corte+Barba + amanha 10h
- [ ] Cancele o agendamento
- [ ] Status muda para CANCELADO
- [ ] Filtros funcionam: filtre por profissional, por cliente, por data

---

## FASE 5 — FLUXO DO CLIENTE (Portal)

### 5.1 Registro do cliente
- [ ] Abra /cliente/login em aba anonima
- [ ] Registre um novo cliente: nome, email, senha
- [ ] Apos registro, redireciona para /cliente
- [ ] Home do cliente carrega sem erros

### 5.2 Login do cliente
- [ ] Faca logout
- [ ] Logue com email/senha criados → funciona
- [ ] (Se Google OAuth configurado) Teste login com Google

### 5.3 Cliente faz agendamento
- [ ] Va em Agendar (/cliente/agendar)
- [ ] **Passo 1:** Servicos listados com precos
- [ ] Promocao "Inauguracao" aparece no "Corte Masculino" com 20% off
- [ ] Selecione "Corte Masculino"
- [ ] **Passo 2:** Calendario semanal aparece
- [ ] Navegue semana anterior/proxima → funciona
- [ ] Horarios disponiveis aparecem agrupados (manha/tarde/noite)
- [ ] Horarios ja ocupados NAO aparecem
- [ ] Selecione um horario disponivel
- [ ] **Passo 3:** Resumo mostra servico, profissional, data, hora
- [ ] Preco mostra desconto da promocao aplicado (R$ 45 → R$ 36)
- [ ] Confirme o agendamento → toast de sucesso

### 5.4 Verificar agendamento criado
- [ ] Na home do cliente (/cliente) → agendamento aparece em "Proximos"
- [ ] Volte ao painel admin em outra aba
- [ ] O agendamento do cliente aparece na lista de Agendamentos
- [ ] Aparece no Dashboard em "Agendamentos de Hoje" (se for hoje)

### 5.5 Perfil do cliente
- [ ] Va em Perfil (/cliente/perfil)
- [ ] Dados exibidos corretamente
- [ ] Edite o telefone → salva
- [ ] Edite CPF, data nascimento → salva

### 5.6 Notificacoes push (cliente)
- [ ] Na home do cliente, banner de notificacoes aparece
- [ ] Aceite notificacoes → browser pede permissao
- [ ] Permissao concedida → inscricao salva

---

## FASE 6 — NOTIFICACOES PUSH (Admin)

- [ ] No painel admin, ative notificacoes push (se houver botao)
- [ ] Aceite a permissao do browser
- [ ] Volte ao portal do cliente e faca um novo agendamento
- [ ] Admin recebe notificacao push do novo agendamento

---

## FASE 7 — COMANDA (Tab/Venda com produtos)

### 7.1 Criar e pagar comanda
- [ ] Va em Comandas (/comandas)
- [ ] Crie uma comanda para Carlos Silva
- [ ] Adicione item SERVICO: "Corte Masculino"
- [ ] Adicione item PRODUTO: "Pomada Modeladora" x1
- [ ] Total correto: R$ 45 + R$ 35 = R$ 80
- [ ] Pague a comanda com PIX
- [ ] Status muda para PAGA
- [ ] Pagamento registrado automaticamente

### 7.2 Verificar impacto no estoque
- [ ] Va em Estoque > Atual → Pomada Modeladora reduziu 1 unidade (se integrado)
- [ ] Va em Estoque > Movimentacoes → movimentacao de saida registrada (se integrado)

### 7.3 Cancelar comanda
- [ ] Crie outra comanda de teste
- [ ] Adicione um item
- [ ] Cancele a comanda → status CANCELADA
- [ ] Exclua a comanda → some da lista

---

## FASE 8 — DIVIDAS

### 8.1 Criar e gerenciar divida
- [ ] Va em Dividas (/dividas)
- [ ] Crie divida: Ana Santos, R$ 60,00, "Corte nao pago", vencimento em 7 dias
- [ ] Divida aparece na lista
- [ ] Va em Clientes → Ana Santos mostra indicador de divida

### 8.2 Pagamento parcial
- [ ] Volte em Dividas
- [ ] Registre pagamento parcial de R$ 30 na divida da Ana
- [ ] Saldo restante: R$ 30,00

### 8.3 Quitar divida
- [ ] Registre mais R$ 30 ou marque como quitada
- [ ] Divida marcada como quitada
- [ ] Va em Clientes → Ana Santos nao mostra mais indicador de divida

---

## FASE 9 — FECHAR O CAIXA

- [ ] Va em Caixa (/caixa)
- [ ] Feche o caixa informando saldo final
- [ ] Discrepancia calculada: esperado vs informado
- [ ] Detalhamento por metodo (DINHEIRO, PIX, CARTAO)
- [ ] Caixa muda para FECHADO
- [ ] Historico mostra o caixa do dia com resumo

---

## FASE 10 — COMISSOES

- [ ] Va em Financeiro > Comissoes (/financeiro/comissoes)
- [ ] Gere comissoes do periodo (hoje)
- [ ] Comissao do Joao: receita dos atendimentos dele x 40%
- [ ] Valor calculado corretamente
- [ ] Marque a comissao como PAGA
- [ ] Status atualiza

---

## FASE 11 — RELATORIOS

> Agora o sistema tem dados. Verifique se os relatorios refletem tudo.

### 11.1 Vendas
- [ ] Va em Relatorios (/relatorios) → selecione "Vendas"
- [ ] Filtro de periodo: hoje
- [ ] Receita total bate com os pagamentos feitos
- [ ] Breakdown por metodo (DINHEIRO, PIX) correto
- [ ] Ticket medio correto
- [ ] Exporte CSV → arquivo baixa

### 11.2 Profissionais
- [ ] Selecione relatorio "Profissionais"
- [ ] Joao: 1 comparecimento, 1 cancelamento
- [ ] Maria: 1 nao comparecimento
- [ ] Receita e comissao por profissional corretas

### 11.3 Servicos
- [ ] Selecione relatorio "Servicos"
- [ ] Ranking de servicos realizados
- [ ] Quantidades e receita batem

### 11.4 Clientes
- [ ] Selecione relatorio "Clientes"
- [ ] Novos clientes no periodo
- [ ] Top clientes por gasto
- [ ] Devedores (se houver dividas pendentes)

### 11.5 Dividas
- [ ] Selecione relatorio "Dividas"
- [ ] Dividas criadas, pagas e pendentes
- [ ] Valores batem com o que foi feito na Fase 8

### 11.6 Caixa
- [ ] Selecione relatorio "Caixa"
- [ ] Receita do dia, media diaria
- [ ] Discrepancia registrada
- [ ] Exporte CSV → arquivo baixa

---

## FASE 12 — DASHBOARD FINAL

> Com dados no sistema, o dashboard deve estar populado.

### 12.1 Aba Operacional
- [ ] KPIs: receita total, numero de agendamentos, clientes atendidos
- [ ] Agendamentos de hoje listados
- [ ] Atividade recente mostra pagamentos e agendamentos
- [ ] Receita por metodo de pagamento

### 12.2 Aba Estrategica
- [ ] Desempenho dos profissionais populado
- [ ] Grafico de receita diaria
- [ ] Servicos mais populares listados

---

## FASE 13 — TESTES DE SEGURANCA E EDGE CASES

### 13.1 Controle de acesso
- [ ] Abra aba anonima, acesse /agendamentos → redireciona para /login
- [ ] Abra aba anonima, acesse /cliente → redireciona para /cliente/login
- [ ] Logado como cliente, tente acessar /agendamentos → bloqueado
- [ ] (Se tiver usuario PROFESSIONAL) Verifique que rotas restritas mostram /acesso-negado

### 13.2 Validacoes de formulario
- [ ] Tente criar servico sem nome → erro de validacao
- [ ] Tente criar cliente sem nome → erro de validacao
- [ ] Tente criar agendamento sem selecionar profissional → erro
- [ ] Tente abrir caixa que ja esta aberto → erro ou impedido

### 13.3 Sessao
- [ ] Faca logout do admin → token limpo, redireciona para /login
- [ ] Faca logout do cliente → token limpo, redireciona para /cliente/login

---

## FASE 14 — PWA E MOBILE

- [ ] Acesse o app pelo celular (ou DevTools mobile)
- [ ] Layout responsivo: sidebar vira menu hamburger
- [ ] Portal do cliente: layout mobile funcional
- [ ] Formularios usaveis no mobile (campos nao cortados)
- [ ] PWA: prompt de instalacao aparece (ou adicionar a tela inicial)
- [ ] Apos instalar, app abre como standalone
- [ ] (iOS Safari) Banner de instalacao aparece

---

## FASE 15 — LIMPEZA E EXTRAS

### 15.1 Edicoes e exclusoes
- [ ] Edite um profissional → salva
- [ ] Desative um profissional → some da selecao de agendamentos
- [ ] Desative um servico → some da selecao
- [ ] Desative um cliente → some da lista (ou filtro)

### 15.2 Asaas (se configurado)
- [ ] Crie cobranca PIX → link/QR gerado
- [ ] Crie cobranca Boleto → boleto gerado
- [ ] Estorne uma cobranca
- [ ] Webhook recebe atualizacao de status

---

## RESULTADO FINAL

| # | Fase | Status | Bugs encontrados |
|---|------|--------|------------------|
| 1 | Setup Inicial | | |
| 2 | Cadastros Base | | |
| 3 | Promocao e Assinatura | | |
| 4 | Agendamento (Admin) | | |
| 5 | Fluxo do Cliente | | |
| 6 | Notificacoes Push | | |
| 7 | Comandas | | |
| 8 | Dividas | | |
| 9 | Fechar Caixa | | |
| 10 | Comissoes | | |
| 11 | Relatorios | | |
| 12 | Dashboard Final | | |
| 13 | Seguranca | | |
| 14 | PWA e Mobile | | |
| 15 | Limpeza e Extras | | |

> **Problemas criticos (bloqueiam entrega):**
> 1.
> 2.
> 3.

> **Problemas menores (podem ir pro backlog):**
> 1.
> 2.
> 3.

> **Aprovado para entrega:** [ ] Sim  [ ] Nao
