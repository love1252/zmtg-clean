import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

async function main() {
  if (process.env.ZMTG_THIRD_BATCH_ISOLATED_TEST !== '1') throw new Error('explicit_isolated_test_required');
  const sql = postgres('postgresql://postgres@127.0.0.1:55486/zmtg_third_batch_isolated_test', { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.begin(async tx => {
      // Fail closed on any existing non-system relation, enum or custom schema.
      const [existing] = await tx`select
        (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname <> 'information_schema')
        + (select count(*)::int from pg_enum)
        + (select count(*)::int from pg_namespace where nspname not like 'pg_%' and nspname not in ('information_schema','public')) as objects`;
      if (existing.objects !== 0) throw new Error('isolated_database_must_be_empty');
      await tx.unsafe(await readFile('scripts/verify/fixtures/third-batch-baseline.sql', 'utf8'));
      await tx.unsafe(await readFile('drizzle/0053_third_batch_human_decisions.sql', 'utf8'));
    });
    console.log('空隔离数据库已准备：相关七张基表与 0053；未加载真实环境配置。');
  } finally { await sql.end(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'isolated_setup_failed'); process.exitCode = 1; });
