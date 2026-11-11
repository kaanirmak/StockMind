import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchSpecificSymbolLive } from '@/lib/data/stocks';
import { fetchTefasLiveDetail } from '@/lib/api/tefas';
import { getFundsFromDatabase } from '@/lib/data/funds';
import type { AlertPriceQuote } from '@/lib/market/alertFreshness';
import {
  evaluateServerPriceAlerts,
  type RecordedAlertTriggerEvent,
  type ServerAlertEventStore,
  type ServerAlertRule,
} from '@/lib/market/serverAlertEvaluator';
import type { AlertCurrencyCode } from '@/lib/market/alertForm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleEvaluateAlerts(request);
}

export async function POST(request: Request) {
  return handleEvaluateAlerts(request);
}

async function resolveQuotesForRules(rules: readonly ServerAlertRule[]): Promise<Map<string, AlertPriceQuote>> {
  const quoteMap = new Map<string, AlertPriceQuote>();
  const stockSymbols = Array.from(
    new Set(rules.filter((r) => r.assetType === 'stock' && !r.alertPaused).map((r) => r.symbol.toUpperCase())),
  );
  const fundSymbols = Array.from(
    new Set(rules.filter((r) => r.assetType === 'fund' && !r.alertPaused).map((r) => r.symbol.toUpperCase())),
  );

  await Promise.all(
    stockSymbols.map(async (symbol) => {
      const live = await fetchSpecificSymbolLive(symbol).catch(() => null);
      if (live) {
        quoteMap.set(`stock:${symbol}`, {
          price: live.price,
          exchange: live.exchange,
          observation: live.observation,
          isLastKnown: live.isLastKnown,
          assetType: 'stock',
        });
      }
    }),
  );

  if (fundSymbols.length > 0) {
    const dbFunds = await getFundsFromDatabase({}).catch(() => []);
    const dbByCode = new Map(dbFunds.map((f) => [f.code.toUpperCase(), f]));

    await Promise.all(
      fundSymbols.map(async (code) => {
        const live = await fetchTefasLiveDetail(code).catch(() => null);
        if (live && typeof live.price === 'number' && live.price > 0) {
          const observedAt = live.navDate || new Date().toISOString();
          quoteMap.set(`fund:${code}`, {
            price: live.price,
            exchange: 'TEFAS',
            assetType: 'fund',
            navDate: live.navDate || null,
            lastSyncAt: new Date().toISOString(),
            observation: {
              source: 'TEFAS Live',
              asOf: observedAt,
              fetchedAt: new Date().toISOString(),
              changePercent: typeof live.dailyReturn === 'number' ? live.dailyReturn : null,
            },
          });
          return;
        }
        const db = dbByCode.get(code);
        if (db && typeof db.price === 'number' && db.price > 0) {
          quoteMap.set(`fund:${code}`, {
            price: db.price,
            exchange: 'TEFAS',
            assetType: 'fund',
            lastSyncAt: db.lastSyncAt,
            navDate: db.navDate,
            observation: db.observation,
          });
        }
      }),
    );
  }

  return quoteMap;
}

async function handleEvaluateAlerts(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecretHeader = request.headers.get('x-cron-secret') || '';
    const expectedSecret = process.env.CRON_SECRET?.trim();

    const isAuthorized =
      Boolean(expectedSecret) &&
      (authHeader === `Bearer ${expectedSecret}` || cronSecretHeader === expectedSecret);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid CRON_SECRET header is required' },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    let queryResult: { data: any[] | null; error: any } = await admin
      .from('watchlist_items')
      .select('id,watchlist_id,symbol,name,asset_type,exchange,target_price,alert_type,alert_percent,alert_base_price,alert_currency,alert_direction,alert_paused,watchlists!inner(user_id)')
      .or('target_price.gt.0,alert_percent.gt.0');

    if (queryResult.error?.code === '42703' || queryResult.error?.code === 'PGRST204') {
      queryResult = await admin
        .from('watchlist_items')
        .select('id,watchlist_id,symbol,name,asset_type,exchange,target_price,alert_type,alert_percent,alert_base_price,watchlists!inner(user_id)')
        .or('target_price.gt.0,alert_percent.gt.0');
    }

    const { data: rows, error: rowsError } = queryResult;

    if (rowsError) {
      throw rowsError;
    }

    const rules: ServerAlertRule[] = (rows || [])
      .map((row: any): ServerAlertRule => ({
        watchlistItemId: row.id,
        userId: Array.isArray(row.watchlists) ? row.watchlists[0]?.user_id : row.watchlists?.user_id,
        symbol: String(row.symbol || '').toUpperCase(),
        name: row.name || row.symbol,
        assetType: row.asset_type === 'fund' ? 'fund' : 'stock',
        exchange: row.exchange || null,
        targetPrice: row.target_price !== null && row.target_price !== undefined ? Number(row.target_price) : null,
        alertType: row.alert_type || 'price',
        alertPercent: row.alert_percent !== null && row.alert_percent !== undefined ? Number(row.alert_percent) : null,
        alertBasePrice: row.alert_base_price !== null && row.alert_base_price !== undefined ? Number(row.alert_base_price) : null,
        alertCurrency: (row.alert_currency || null) as AlertCurrencyCode | null,
        alertDirection: row.alert_direction || null,
        alertPaused: Boolean(row.alert_paused),
      }))
      .filter((r) => Boolean(r.userId && r.symbol));

    if (rules.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        checkedCount: 0,
        skippedPausedCount: 0,
        deferredCount: 0,
        triggeredCount: 0,
        deduplicatedCount: 0,
        events: [],
      });
    }

    const quotes = await resolveQuotesForRules(rules);

    const store: ServerAlertEventStore = {
      async hasEventKey(eventKey: string) {
        const { data, error } = await admin
          .from('alert_trigger_events')
          .select('id')
          .eq('event_key', eventKey)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data?.id);
      },
      async insertEvent(event: RecordedAlertTriggerEvent) {
        const { error } = await admin.from('alert_trigger_events').insert({
          user_id: event.userId,
          watchlist_item_id: event.watchlistItemId ?? null,
          symbol: event.symbol,
          asset_type: event.assetType,
          alert_type: event.alertType,
          event_key: event.eventKey,
          observed_price: event.observedPrice,
          target_price: event.targetPrice ?? null,
          base_price: event.basePrice ?? null,
          alert_percent: event.alertPercent ?? null,
          currency: event.currency,
          title: event.title,
          message: event.message,
          link: event.link,
          triggered_at: event.triggeredAt,
        });
        if (error) {
          if (error.code === '23505') return { inserted: false, duplicate: true };
          throw error;
        }
        return { inserted: true };
      },
      async updateRuleEvaluation(update) {
        if (!update.watchlistItemId) return;
        const patch: Record<string, unknown> = {
          last_checked_at: update.checkedAt,
          ...(update.observedPrice !== null ? { last_observed_price: update.observedPrice } : {}),
          ...(update.triggeredAt ? { last_triggered_at: update.triggeredAt } : {}),
          ...(typeof update.triggeredPrice === 'number' ? { last_triggered_price: update.triggeredPrice } : {}),
          ...(typeof update.nextBasePrice === 'number' ? { alert_base_price: update.nextBasePrice } : {}),
        };
        const { error } = await admin
          .from('watchlist_items')
          .update(patch)
          .eq('id', update.watchlistItemId);
        // Ignore optional column mismatch if newer migration columns are not applied yet.
        if (error && error.code !== '42703' && error.code !== 'PGRST204') {
          throw error;
        }
      },
    };

    const summary = await evaluateServerPriceAlerts({
      rules,
      quotes,
      store,
      now: new Date(),
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error: any) {
    console.error('Server Alert Evaluation Cron Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Sunucu alarm değerlendirmesi başarısız oldu.' },
      { status: 500 },
    );
  }
}
