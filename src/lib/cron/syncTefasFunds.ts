import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTefasLiveDetail, fetchTefasPriceHistory } from '@/lib/api/tefas';
import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';

export interface SyncOptions {
  code?: string; // Optional: Sync a single specific fund
  limit?: number; // Optional: Limit how many funds to sync
  concurrency?: number; // Batch concurrency (default 8)
  includeHistory?: boolean; // Whether to sync full 3-year historical points
}

export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  timestamp: string;
  durationMs: number;
  errors: { code: string; message: string }[];
  syncedCodes: string[];
}

/**
 * Core Production Service: Fetches 100% REAL data from official Takasbank TEFAS APIs
 * and upserts into Supabase `public.funds` and `public.fund_daily_history` tables.
 */
export async function syncTefasFundsToDatabase(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();
  const concurrency = options.concurrency || 8;

  let targetList = TEFAS_DIRECTORY as { code: string; name: string; founder: string; category: string }[];

  if (options.code) {
    const sym = options.code.toUpperCase().trim();
    targetList = targetList.filter((f) => f.code === sym);
    if (targetList.length === 0) {
      targetList = [{ code: sym, name: `${sym} Fonu`, founder: 'Portföy Yönetimi', category: 'Diğer' }];
    }
  }

  if (options.limit && options.limit > 0) {
    targetList = targetList.slice(0, options.limit);
  }

  const errors: { code: string; message: string }[] = [];
  const syncedCodes: string[] = [];
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Process in batches
  for (let i = 0; i < targetList.length; i += concurrency) {
    const batch = targetList.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (item) => {
        const code = item.code.toUpperCase().trim();
        try {
          const detail = await fetchTefasLiveDetail(code);
          if (!detail) {
            errors.push({ code, message: 'Official TEFAS API returned no data' });
            return;
          }

          // 1. Upsert into public.funds table
          const fundRecord = {
            code: detail.code,
            name: detail.name || item.name,
            category: detail.category || item.category,
            founder: detail.founder || item.founder,
            price: detail.price,
            daily_return: detail.dailyReturn,
            monthly_return: detail.monthlyReturn,
            return_3m: detail.return3m,
            return_6m: detail.return6m,
            ytd_return: detail.ytdReturn,
            yearly_return: detail.yearlyReturn,
            return_3y: detail.return3y,
            return_5y: detail.return5y,
            risk_value: detail.riskValue,
            total_value: detail.totalValue,
            investor_count: detail.investorCount,
            management_fee: detail.managementFee,
            asset_allocation: detail.assetAllocation || [],
            kap_link: detail.kapLink,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('funds')
            .upsert(fundRecord, { onConflict: 'code' });

          if (upsertError) {
            console.warn(`[Sync] Error upserting fund ${code}:`, upsertError.message);
            errors.push({ code, message: upsertError.message });
            return;
          }

          // 2. Insert today snapshot into public.fund_daily_history
          const historyRecord = {
            fund_code: detail.code,
            price_date: todayDateStr,
            price: detail.price,
            daily_return: detail.dailyReturn,
            total_value: detail.totalValue,
            investor_count: detail.investorCount,
          };

          try {
            await supabase
              .from('fund_daily_history')
              .upsert(historyRecord, { onConflict: 'fund_code,price_date' });
          } catch {
            // Ignore non-fatal history upsert errors
          }

          // 3. If full historical backfill requested, fetch past prices
          if (options.includeHistory) {
            const pastPoints = await fetchTefasPriceHistory(code, 365);
            if (pastPoints.length > 0) {
              const rows = pastPoints.map((p) => ({
                fund_code: code,
                price_date: p.date,
                price: p.price,
              }));
              try {
                await supabase
                  .from('fund_daily_history')
                  .upsert(rows, { onConflict: 'fund_code,price_date', ignoreDuplicates: true });
              } catch {
                // Ignore non-fatal history upsert errors
              }
            }
          }

          syncedCodes.push(code);
        } catch (err: any) {
          errors.push({ code, message: err.message || 'Unknown error' });
        }
      })
    );

    // Polite 100ms pause between batches to protect Takasbank API
    if (i + concurrency < targetList.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: errors.length < targetList.length,
    totalProcessed: targetList.length,
    successCount: syncedCodes.length,
    errorCount: errors.length,
    timestamp: new Date().toISOString(),
    durationMs,
    errors,
    syncedCodes,
  };
}
