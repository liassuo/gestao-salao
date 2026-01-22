import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Criar usuário admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@barbearia.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@barbearia.com',
      password: '$2b$10$Tcd7wgsPNuu92j4g1bfCVeW9kOS7FFV7aKLQOmeJbVpzW3j4f4X8S', // 123456
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Admin criado:', admin.email);

  // Criar alguns serviços de exemplo
  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: 'service-corte' },
      update: {},
      create: {
        id: 'service-corte',
        name: 'Corte de Cabelo',
        description: 'Corte masculino tradicional',
        price: 4500, // R$ 45,00
        duration: 30,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { id: 'service-barba' },
      update: {},
      create: {
        id: 'service-barba',
        name: 'Barba',
        description: 'Aparar e modelar barba',
        price: 3000, // R$ 30,00
        duration: 20,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { id: 'service-combo' },
      update: {},
      create: {
        id: 'service-combo',
        name: 'Corte + Barba',
        description: 'Combo corte e barba',
        price: 6500, // R$ 65,00
        duration: 45,
        isActive: true,
      },
    }),
  ]);

  console.log('Serviços criados:', services.length);

  // Criar profissional de exemplo
  const professional = await prisma.professional.upsert({
    where: { id: 'professional-1' },
    update: {},
    create: {
      id: 'professional-1',
      name: 'João Barbeiro',
      phone: '11999999999',
      email: 'joao@barbearia.com',
      commissionRate: 50.00,
      workingHours: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' },
      ],
      isActive: true,
      services: {
        connect: services.map(s => ({ id: s.id })),
      },
    },
  });

  console.log('Profissional criado:', professional.name);

  // Criar cliente de exemplo
  const client = await prisma.client.upsert({
    where: { id: 'client-1' },
    update: {},
    create: {
      id: 'client-1',
      name: 'Carlos Cliente',
      email: 'carlos@email.com',
      phone: '11988888888',
      isActive: true,
    },
  });

  console.log('Cliente criado:', client.name);

  console.log('\n--- Seed concluído! ---');
  console.log('Login admin: admin@barbearia.com / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
