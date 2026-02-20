import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita validação global dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos não declarados no DTO
      forbidNonWhitelisted: true, // Retorna erro se enviar campo não declarado
      transform: true, // Transforma tipos automaticamente
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors();

  // Swagger Configuration
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
- **Pagamentos**: Registro de pagamentos (sem processamento)
- **Dívidas**: Controle de fiado/crédito de clientes
- **Caixa**: Abertura e fechamento de caixa diário
- **Dashboard**: Estatísticas e métricas
- **Relatórios**: Relatórios gerenciais

### Regras de Negócio Importantes

- **Agendamento ≠ Pagamento**: Um atendimento pode ser realizado sem pagamento
- **Pagamentos são manuais**: O sistema apenas registra, não processa pagamentos
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'API Gestão Salão - Documentação',
  });

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger docs available at: ${await app.getUrl()}/api/docs`);
}

bootstrap();
