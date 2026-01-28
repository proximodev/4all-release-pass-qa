/**
 * Seed script for DictionaryWord table
 * Run with: npx tsx prisma/seed-dictionary.ts
 *
 * Idempotent: skips existing words (preserves their status)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Words to seed - will be added with status=WHITELISTED, source=SEED
// Only includes words likely to trigger LanguageTool spelling errors.
// Standard dictionary words and short all-caps acronyms (filtered by proper noun heuristics) are excluded.
const SEED_WORDS = [
  // Brands with unusual casing (likely flagged)
  'iPhone', 'iPad', 'macOS', 'iOS', 'LinkedIn', 'WordPress',
  'HubSpot', 'TikTok', 'GitHub', 'PayPal', 'QuickBooks',
  'ChatGPT', 'OpenAI', 'DevOps', 'DocuSign', 'MailChimp',

  // Less common tech brands (may not be in dictionaries)
  'Airtable', 'Webflow', 'Squarespace', 'Cloudflare', 'Vercel',
  'Netlify', 'Supabase', 'Prisma', 'Tailwind',

  // Compound tech terms often flagged
  'ecommerce', 'eCommerce', 'signup', 'signin', 'dropdown',
  'popup', 'popups', 'navbar', 'sidebar', 'favicon',
  'frontend', 'backend', 'fullstack', 'microservices',
  'serverless', 'webhook', 'webhooks', 'localhost', 'subdomain',
  'subdomains', 'sitemap', 'sitemaps', 'webinar', 'webinars',

  // ReleasePass brand
  'ReleasePass',
];

async function main() {
  console.log('Seeding dictionary words...');

  let created = 0;
  let skipped = 0;

  for (const displayWord of SEED_WORDS) {
    const word = displayWord.toLowerCase();

    // Check if word already exists
    const existing = await prisma.dictionaryWord.findUnique({
      where: { word },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create new word
    await prisma.dictionaryWord.create({
      data: {
        word,
        displayWord,
        status: 'WHITELISTED',
        source: 'SEED',
      },
    });
    created++;
  }

  console.log(`Dictionary seeding complete: ${created} created, ${skipped} skipped (already existed)`);
}

main()
  .catch((e) => {
    console.error('Error seeding dictionary:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
