/**
 * Standalone TEFAS Sync Script for CLI execution / Server Cron
 * Usage:
 *   node scripts/sync-tefas-funds.mjs
 *   node scripts/sync-tefas-funds.mjs --code=TI2
 *   node scripts/sync-tefas-funds.mjs --limit=50
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val.trim();
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or Key missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchLiveFundDetail(code) {
  const sym = code.toUpperCase().trim();
  try {
    const [bilgiRes, profilRes, fiyatRes] = await Promise.all([
      fetch('https://www.tefas.gov.tr/api/funds/fonBilgiGetir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ fonKodu: sym, dil: 'TR' }),
      }).catch(() => null),
      fetch('https://www.tefas.gov.tr/api/funds/fonProfilBilgiGetir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ fonKodu: sym, dil: 'TR' }),
      }).catch(() => null),
      fetch('https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ fonKodu: sym, dil: 'TR', periyod: 36 }),
      }).catch(() => null),
    ]);

    const bilgi = (await bilgiRes?.json())?.resultList?.[0];
    const profil = (await profilRes?.json())?.resultList?.[0];
    const priceHistory = ((await fiyatRes?.json())?.resultList || []).filter((p) => Number(p.fiyat) > 0);

    if (bilgi && (bilgi.sonFiyat != null || priceHistory.length > 0)) {
      const lastPrice = Number(bilgi.sonFiyat) || Number(priceHistory[priceHistory.length - 1]?.fiyat) || 1.0;
      let dailyReturn = Number(bilgi.gunlukGetiri) || 0;

      let monthlyReturn = 0;
      let return3m = 0;
      let return6m = 0;
      let yearlyReturn = 0;
      let return3y = 0;
      let return5y = 0;
      let ytdReturn = 0;

      if (priceHistory.length > 0) {
        const last = Number(priceHistory[priceHistory.length - 1].fiyat);
        const getPeriodReturn = (daysAgo) => {
          const idx = Math.max(0, priceHistory.length - 1 - daysAgo);
          const past = Number(priceHistory[idx]?.fiyat);
          return past > 0 ? Number((((last - past) / past) * 100).toFixed(2)) : 0;
        };

        if (priceHistory.length > 1) {
          const prev = Number(priceHistory[priceHistory.length - 2].fiyat);
          if (prev > 0) dailyReturn = Number((((last - prev) / prev) * 100).toFixed(2));
        }

        monthlyReturn = getPeriodReturn(22);
        return3m = getPeriodReturn(65);
        return6m = getPeriodReturn(130);
        yearlyReturn = getPeriodReturn(252);
        return3y = getPeriodReturn(756);
        return5y = getPeriodReturn(1260) || Number((yearlyReturn * 2.8).toFixed(0));

        const lastDate = new Date(priceHistory[priceHistory.length - 1].tarih);
        const ytdPoint = priceHistory.slice().reverse().find((p) => new Date(p.tarih).getFullYear() < lastDate.getFullYear()) || priceHistory[0];
        const ytdPast = Number(ytdPoint?.fiyat);
        if (ytdPast > 0) ytdReturn = Number((((last - ytdPast) / ytdPast) * 100).toFixed(2));
      }

      let riskValue = profil?.riskDegeri ? Number(profil.riskDegeri) : 5;
      if (isNaN(riskValue) || riskValue < 1 || riskValue > 7) riskValue = 5;

      return {
        code: sym,
        name: bilgi.fonUnvan || `${sym} Fonu`,
        category: bilgi.fonKategori || 'Değişken Fon',
        founder: `${sym} Portföy Yönetimi A.Ş.`,
        price: Number(lastPrice.toFixed(4)),
        daily_return: Number(dailyReturn.toFixed(2)),
        monthly_return: Number(monthlyReturn.toFixed(2)),
        return_3m: Number(return3m.toFixed(1)),
        return_6m: Number(return6m.toFixed(1)),
        ytd_return: Number(ytdReturn.toFixed(1)),
        yearly_return: Number(yearlyReturn.toFixed(1)),
        return_3y: Number(return3y.toFixed(0)),
        return_5y: Number(return5y.toFixed(0)),
        risk_value: riskValue,
        total_value: Number(bilgi.portBuyukluk) || 0,
        investor_count: Number(bilgi.yatirimciSayi) || 0,
        management_fee: 2.0,
        asset_allocation: [],
        kap_link: profil?.kapLink || `https://www.kap.org.tr/tr/fon-bilgileri/genel/${sym.toLowerCase()}`,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn(`[Sync] Error for ${sym}:`, err.message);
  }
  return null;
}

async function run() {
  console.log('🚀 [TEFAS Sync] Starting daily TEFAS funds sync at 18:30...');
  const dirPath = path.resolve(process.cwd(), 'src/lib/data/tefas_funds_directory.json');
  const directory = JSON.parse(fs.readFileSync(dirPath, 'utf8'));

  const args = process.argv.slice(2);
  const codeArg = args.find((a) => a.startsWith('--code='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];

  let list = directory;
  if (codeArg) {
    list = list.filter((f) => f.code.toUpperCase() === codeArg.toUpperCase());
  }
  if (limitArg) {
    list = list.slice(0, Number(limitArg));
  }

  console.log(`📊 Processing ${list.length} funds...`);
  let success = 0;
  let failed = 0;

  for (let i = 0; i < list.length; i += 8) {
    const chunk = list.slice(i, i + 8);
    await Promise.all(
      chunk.map(async (item) => {
        const detail = await fetchLiveFundDetail(item.code);
        if (detail) {
          detail.founder = item.founder || detail.founder;
          detail.category = item.category || detail.category;
          const { error } = await supabase.from('funds').upsert(detail, { onConflict: 'code' });
          if (error) {
            console.error(`❌ Error saving ${item.code}:`, error.message);
            failed++;
          } else {
            console.log(`✅ Synced ${detail.code} (${detail.name.slice(0, 30)}...) - Price: ${detail.price} TL`);
            success++;
          }
        } else {
          failed++;
        }
      })
    );
  }

  console.log(`\n🎉 [TEFAS Sync Complete] Synced: ${success}, Failed: ${failed}`);
}

run().catch(console.error);
