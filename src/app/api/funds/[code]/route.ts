import { NextResponse } from 'next/server';
import { fetchTefasLiveDetail, fetchTefasPriceHistory } from '@/lib/api/tefas';
import { getFundByCodeFromDatabase, getFundByCode, generateFundHistory } from '@/lib/data/funds';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase().trim();
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') ? Number(searchParams.get('days')) : 90;

    const supabase = createAdminClient();

    // 1. Fetch live detail and price history from official TEFAS API
    const [liveDetail, realHistory, dbFund] = await Promise.all([
      fetchTefasLiveDetail(upperCode),
      fetchTefasPriceHistory(upperCode, days),
      getFundByCodeFromDatabase(upperCode),
    ]);

    let fund = liveDetail || dbFund || getFundByCode(upperCode);
    let history: { date: string; price: number }[] = realHistory;

    // If live history empty, try fetching from DB history table
    if (history.length === 0 && dbFund) {
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
    }

    // If live detail fetched, persist to DB in background
    if (liveDetail) {
      (async () => {
        try {
          await supabase.from('funds').upsert(
            {
              code: liveDetail.code,
              name: liveDetail.name,
              category: liveDetail.category,
              founder: liveDetail.founder,
              price: liveDetail.price,
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
                last_sync_at: new Date().toISOString(),
              },
              { onConflict: 'code' }
            );

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
        })();
    }

    if (!fund) {
      return NextResponse.json(
        { success: false, error: 'Fon bulunamadı' },
        { status: 404 }
      );
    }

    if (history.length === 0) {
      history = generateFundHistory(upperCode, days, fund.price);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...fund,
        history,
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
