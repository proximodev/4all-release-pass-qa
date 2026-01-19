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

  // Create companies and track the default company ID
  let defaultCompanyId: string | null = null

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

    if (company.name === '4All Digital') {
      defaultCompanyId = result.id
    }

    console.log(`  ✓ Company: ${company.name} (${result.id})`)
  }

  console.log(`\nSeeded ${companies.length} companies.\n`)

  if (!defaultCompanyId) {
    console.error('  ✗ Could not find default company ID')
    return
  }

  // Update existing users without a company
  const usersWithoutCompany = await prisma.user.count({
    where: { companyId: null },
  })

  if (usersWithoutCompany > 0) {
    const updateResult = await prisma.user.updateMany({
      where: { companyId: null },
      data: { companyId: defaultCompanyId },
    })
    console.log(`  ✓ Assigned ${updateResult.count} users to "4All Digital"`)
  } else {
    console.log('  - No users need company assignment')
  }

  // Update existing projects without a company
  const projectsWithoutCompany = await prisma.project.count({
    where: { companyId: null },
  })

  if (projectsWithoutCompany > 0) {
    const updateResult = await prisma.project.updateMany({
      where: { companyId: null },
      data: { companyId: defaultCompanyId },
    })
    console.log(`  ✓ Assigned ${updateResult.count} projects to "4All Digital"`)
  } else {
    console.log('  - No projects need company assignment')
  }

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
