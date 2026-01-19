/**
 * Seed script for Company table
 * Creates system companies and assigns existing users/projects to default company
 * Run with: npx tsx prisma/seed-companies.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// System companies to seed
const companies = [
  {
    name: '4All Digital',
    url: 'https://4all.digital',
    isSystem: false, // Default company, can be edited
  },
  {
    name: 'Unassigned',
    url: null,
    isSystem: true, // Cannot be deleted, used for orphaned records
  },
]

async function main() {
  console.log('Seeding Company table...\n')

  for (const company of companies) {
    const result = await prisma.company.upsert({
      where: {
        // Use a combination that's unique - we'll find by name first
        id: (await prisma.company.findFirst({ where: { name: company.name } }))?.id ?? '00000000-0000-0000-0000-000000000000'
      },
      update: {
        url: company.url,
        isSystem: company.isSystem,
      },
      create: {
        name: company.name,
        url: company.url,
        isSystem: company.isSystem,
      },
    })

    console.log(`  ✓ Company: ${company.name} (${result.id})`)
  }

  console.log(`\nSeeded ${companies.length} companies.`)
  console.log('\nDone!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
