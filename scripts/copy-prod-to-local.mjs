/**
 * Safe Data Copy: 5433 (Source / Prod - READ ONLY) -> 5432 (Destination / Local)
 * 
 * GUARANTEES:
 * - Port 5433 is strictly READ-ONLY (only SELECT queries are executed).
 * - Port 5432 is the only target where data is written.
 */

import { PrismaClient } from '@prisma/client';

const SOURCE_URL = process.env.SOURCE_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const DEST_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
});

const destPrisma = new PrismaClient({
  datasources: { db: { url: DEST_URL } },
});

// Priority / Dependency order
const ORDERED_TABLES = [
  'PricingSettings',
  'DiamondRate',
  'GoldRate',
  'SiteBanner',
  'hero_images',
  'HomeSection',
  'Collection',
  'PromoCode',
  'User',
  'GuestUser',
  'ContactRequest',
  'Product',
  'ProductVariant',
  'ProductStone',
  'CollectionProduct',
  'Wishlist',
  'CartItem',
  'Review',
  'CatalogueProgress',
  'CatalogueReaction',
  'CatalogueComment',
  'Address',
  'Order',
  'OrderItem',
  'Payment',
  'Shipment',
  'OrderEvent',
  'OrderRefund',
  'OrderNote',
  'PromoRedemption',
  'Invoice',
  'AnalyticsEvent',
];

async function main() {
  console.log('====================================================');
  console.log('Safe Database Sync');
  console.log('Source (READ ONLY):', SOURCE_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('Destination (WRITE):', DEST_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('====================================================\n');

  // 1. Verify Source Connection
  try {
    const srcCheck = await sourcePrisma.$queryRaw`SELECT current_database(), current_user, inet_server_port()`;
    console.log('✅ Source Connected (READ-ONLY):', srcCheck);
  } catch (err) {
    console.error('❌ Could not connect to SOURCE at localhost:5433.');
    console.error('   Please ensure your SSH/tunnel to port 5433 is active and running.');
    console.error('   Error details:', err.message);
    process.exit(1);
  }

  // 2. Verify Destination Connection
  try {
    const dstCheck = await destPrisma.$queryRaw`SELECT current_database(), current_user, inet_server_port()`;
    console.log('✅ Destination Connected:', dstCheck);
  } catch (err) {
    console.error('❌ Could not connect to DESTINATION at localhost:5432.');
    console.error('   Error details:', err.message);
    process.exit(1);
  }

  // 3. Get all public tables present in source
  const sourceTablesRaw = await sourcePrisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const availableSourceTables = new Set(sourceTablesRaw.map((t) => t.table_name));

  // Determine copy list
  const tablesToCopy = [
    ...ORDERED_TABLES.filter((t) => availableSourceTables.has(t)),
    ...Array.from(availableSourceTables).filter((t) => !ORDERED_TABLES.includes(t) && !t.startsWith('_')),
  ];

  console.log(`\nFound ${tablesToCopy.length} tables to copy from Source:\n`, tablesToCopy.join(', '), '\n');

  // 4. Temporarily disable foreign key trigger checks on Destination for clean load
  await destPrisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);

  let totalRowsCopied = 0;

  try {
    for (const tableName of tablesToCopy) {
      process.stdout.write(`Copying [${tableName}]... `);

      // Fetch columns and data from SOURCE (Read-only SELECT)
      const rows = await sourcePrisma.$queryRawUnsafe(`SELECT * FROM public."${tableName}"`);

      if (rows.length === 0) {
        console.log('0 rows (empty, skipped)');
        continue;
      }

      // Truncate table on destination to prevent duplicate key conflicts
      await destPrisma.$executeRawUnsafe(`TRUNCATE TABLE public."${tableName}" CASCADE;`);

      // Batch insert into Destination
      const columns = Object.keys(rows[0]);
      const colList = columns.map((c) => `"${c}"`).join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuesClauses = [];
        const params = [];
        let pIndex = 1;

        for (const row of batch) {
          const rowParams = [];
          for (const col of columns) {
            let val = row[col];
            // Format BigInt / JSON if needed
            if (typeof val === 'bigint') {
              val = Number(val);
            }
            rowParams.push(`$${pIndex++}`);
            params.push(val);
          }
          valuesClauses.push(`(${rowParams.join(', ')})`);
        }

        const insertQuery = `INSERT INTO public."${tableName}" (${colList}) VALUES ${valuesClauses.join(', ')} ON CONFLICT DO NOTHING;`;
        await destPrisma.$queryRawUnsafe(insertQuery, ...params);
      }

      console.log(`✅ ${rows.length} rows copied`);
      totalRowsCopied += rows.length;
    }

    console.log(`\n🎉 Data sync completed successfully! Total rows copied: ${totalRowsCopied}`);
  } catch (err) {
    console.error('\n❌ Error during sync:', err);
  } finally {
    // Re-enable normal foreign key triggers on Destination
    await destPrisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
    await sourcePrisma.$disconnect();
    await destPrisma.$disconnect();
  }
}

main().catch(console.error);
