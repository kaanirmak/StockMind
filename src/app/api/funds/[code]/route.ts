import { after, NextResponse } from 'next/server';
import { fetchTefasLiveDetail, fetchTefasPriceHistory } from '@/lib/api/tefas';
import {
  getFundByCodeFromDatabase,
  getFundByCode,
  getFundsFromDatabase,
  getSupabaseFundsClient,
  TEFAS_FUNDS,
  type TefasFundInfo,
} from '@/lib/data/funds';
import { findSimilarFunds } from '@/lib/market/fundComparison';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase().trim();
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') ? Number(searchParams.get('days')) : 90;

    const supabase = getSupabaseFundsClient();

    // 1. Fetch live detail, price history, DB detail, and candidate peer pool concurrently
    const [liveDetail, realHistory, dbFund, dbCandidates] = await Promise.all([
      fetchTefasLiveDetail(upperCode),
      fetchTefasPriceHistory(upperCode, days),
      getFundByCodeFromDatabase(upperCode),
      getFundsFromDatabase({ limit: 200 }),
    ]);

    const fund = liveDetail || dbFund || getFundByCode(upperCode);
    let history: { date: string; price: number }[] = realHistory;

    // If live history empty, try fetching from DB history table
    if (history.length === 0 && dbFund && supabase) {
      try {
        const { data: dbHistory } = await supabase
          .from('fund_daily_history')
          .select('price_date, price')
          .eq('fund_code', upperCode)
          .order('price_date', { ascending: true })
          .limit(days);

        if (dbHistory && dbHistory.length > 0) {
          history = dbHistory.map((h: any) => ({
            date: h.price_date,
            price: Number(h.price),
          }));
        }
      } catch {}
    }

    // If live detail fetched, persist to DB in background
    if (liveDetail && supabase) {
      after(async () => {
        try {
          const { error } = await supabase.from('funds').upsert(
            {
              code: liveDetail.code,
              name: liveDetail.name,
              category: liveDetail.category,
              founder: liveDetail.founder,
              price: liveDetail.price,
                nav_date: liveDetail.navDate ?? null,
              daily_return: liveDetail.dailyReturn,
                monthly_return: liveDetail.monthlyReturn,
                return_3m: liveDetail.return3m,
                return_6m: liveDetail.return6m,
                ytd_return: liveDetail.ytdReturn,
                yearly_return: liveDetail.yearlyReturn,
                return_3y: liveDetail.return3y,
                return_5y: liveDetail.return5y,
                risk_value: liveDetail.riskValue,
                total_value: liveDetail.totalValue,
                investor_count: liveDetail.investorCount,
                management_fee: liveDetail.managementFee,
                asset_allocation: liveDetail.assetAllocation,
                kap_link: liveDetail.kapLink,
                last_sync_at: liveDetail.lastSyncAt,
              },
              { onConflict: 'code' }
            );
          if (error) console.warn('[Fund API] Background DB cache error:', error.code);

            if (realHistory && realHistory.length > 0) {
              const rows = realHistory.map((p) => ({
                fund_code: upperCode,
                price_date: p.date,
                price: p.price,
              }));
              await supabase
                .from('fund_daily_history')
                .upsert(rows, { onConflict: 'fund_code,price_date', ignoreDuplicates: true });
            }
          } catch (e) {
            console.warn('[Fund API] Background DB cache error:', e);
          }
      });
    }

    if (!fund) {
      return NextResponse.json(
        { success: false, error: 'Fon bulunamadı' },
        { status: 404 }
      );
    }

    // Merge DB-enriched funds with base directory so similar recommendations always explain match rationale
    const mergedByCode = new Map<string, TefasFundInfo>();
    for (const dirFund of TEFAS_FUNDS) {
      mergedByCode.set(dirFund.code, dirFund);
    }
    for (const dbPeer of dbCandidates) {
      mergedByCode.set(dbPeer.code, dbPeer);
    }
    const similarFunds = findSimilarFunds(fund, Array.from(mergedByCode.values()), {
      limit: 6,
    });

    // If real history is unavailable from TEFAS or DB cache, do NOT fabricate synthetic history.
    // Return empty history honestly per DATA-01.

    return NextResponse.json({
      success: true,
      data: {
        ...fund,
        history,
        similarFunds,
      },
    });
  } catch (error) {
    console.error('Fund Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Fon detayı alınamadı' },
      { status: 500 }
    );
  }
}
