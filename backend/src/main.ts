import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Segurança: headers HTTP (XSS, clickjacking, MIME sniffing, etc.)
  app.use(helmet());

  // Habilita validação global dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Timeout global de 30s para evitar requests pendurados no free tier
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  app.use(compression());
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // CORS restrito: aceita apenas origens configuradas
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const allowedOrigins = frontendUrl.split(',').map((origin) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight por 24h — reduz OPTIONS requests
  });

  // Health check — usado por serviços de keep-alive para evitar cold start
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => res.json({ status: 'ok' }));

  // Swagger — apenas em desenvolvimento (evita custo de CPU/memória no boot em produção)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API Gestão de Salão/Barbearia')
      .setDescription(
        `
## Sistema de Gestão de Salão/Barbearia

Esta API fornece endpoints para gerenciar:

- **Autenticação**: Login de usuários do sistema e clientes
- **Usuários**: Administradores e profissionais
- **Clientes**: Cadastro e gerenciamento de clientes
- **Profissionais**: Barbeiros/Cabeleireiros
- **Serviços**: Catálogo de serviços oferecidos
- **Agendamentos**: Marcação e gestão de horários
- **Pagamentos**: Registro de pagamentos (manual e digital via Asaas)
- **Asaas**: Integração com gateway de pagamento (PIX e cartão)
- **Dívidas**: Controle de fiado/crédito de clientes
- **Caixa**: Abertura e fechamento de caixa diário
- **Dashboard**: Estatísticas e métricas
- **Relatórios**: Relatórios gerenciais

### Regras de Negócio Importantes

- **Agendamento ≠ Pagamento**: Um atendimento pode ser realizado sem pagamento
- **Pagamentos manuais e digitais**: Suporta registro manual (dinheiro, PIX, cartão) e cobrança digital via Asaas
- **Dívidas são independentes**: Não estão vinculadas ao método de pagamento
- **Preços em centavos**: Todos os valores monetários são em centavos (5000 = R$ 50,00)
- **Um caixa por dia**: Apenas um caixa pode estar aberto por data
        `,
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Autenticação e autorização')
      .addTag('Users', 'Gerenciamento de usuários do sistema')
      .addTag('Clients', 'Gerenciamento de clientes')
      .addTag('Professionals', 'Gerenciamento de profissionais')
      .addTag('Services', 'Catálogo de serviços')
      .addTag('Appointments', 'Agendamentos')
      .addTag('Payments', 'Registro de pagamentos')
      .addTag('Debts', 'Controle de dívidas/fiado')
      .addTag('Cash Register', 'Controle de caixa')
      .addTag('Dashboard', 'Estatísticas e métricas')
      .addTag('Reports', 'Relatórios gerenciais')
      .addTag('Asaas', 'Integração com gateway de pagamento Asaas')
      .addTag('Webhooks', 'Webhooks para notificações externas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: 'API Gestão Salão - Documentação',
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs available at: ${await app.getUrl()}/api/docs`);
  }
}

bootstrap();
