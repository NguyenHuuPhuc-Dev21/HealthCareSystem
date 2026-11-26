/**
 * CLI: npm run ops:embargo-check [-- --override-embargo="<reason>"]
 *
 * Exit 0 = OK to deploy / restart / run maintenance now; exit 3 = inside the 19:00–21:00 shift handover window
 * (NFR-AVAIL-01). Meant as the first step of any deploy job and of manual maintenance (see
 * docs/runbooks/maintenance-embargo.md). Reads the window from system_configs when DATABASE_URL is reachable.
 */
import 'dotenv/config';
import pg from 'pg';
import { DEFAULT_EMBARGO, checkEmbargo, formatWindow, loadEmbargoWindow, type EmbargoWindow } from '../core/maintenance';

async function readWindow(): Promise<EmbargoWindow> {
  if (!process.env.DATABASE_URL) return DEFAULT_EMBARGO;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return await loadEmbargoWindow(client);
  } catch (err) {
    console.warn(`[embargo] could not read system_configs (${(err as Error).message}); using ${formatWindow(DEFAULT_EMBARGO)}`);
    return DEFAULT_EMBARGO;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const override = process.argv.find((a) => a.startsWith('--override-embargo='))?.slice('--override-embargo='.length) ?? null;
  const w = await readWindow();
  const d = checkEmbargo(Date.now(), w, 'enforce', 'Triển khai / bảo trì', override);
  if (d.message) console.warn(d.message);
  if (!d.allowed) process.exit(3);
  console.log(`[embargo] OK — ngoài khung bàn giao ca ${formatWindow(w)} (giờ VN).`);
}

main().catch((err: unknown) => {
  console.error(`[embargo] ${(err as Error).message}`);
  process.exit(1);
});
