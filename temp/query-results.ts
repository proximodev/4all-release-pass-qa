import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.resultItem.findMany({
    where: { urlResultId: 'f8fb3372-3fc4-447c-8aa7-5b0fab437edf' },
    orderBy: [{ status: 'desc' }, { provider: 'asc' }, { code: 'asc' }],
    select: { code: true, name: true, status: true, severity: true, provider: true }
  });

  console.log('\n=== FAIL RESULTS ===');
  const fails = items.filter(i => i.status === 'FAIL');
  for (const item of fails) {
    console.log(`[${item.severity || 'n/a'}] ${item.code} (${item.provider})`);
  }

  console.log('\n=== PASS RESULTS ===');
  const passes = items.filter(i => i.status === 'PASS');
  for (const item of passes) {
    console.log(`${item.code} (${item.provider})`);
  }

  console.log(`\nTotal: ${fails.length} FAIL, ${passes.length} PASS`);

  await prisma.$disconnect();
}

main();
