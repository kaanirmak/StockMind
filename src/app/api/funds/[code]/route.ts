import { NextResponse } from 'next/server';
import { fetchTefasLiveDetail, fetchTefasPriceHistory } from '@/lib/api/tefas';
import { getFundByCode, generateFundHistory } from '@/lib/data/funds';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase().trim();
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') ? Number(searchParams.get('days')) : 90;

    // Parallel fetch from TEFAS live detail + official TEFAS price history
    const [liveDetail, realHistory] = await Promise.all([
      fetchTefasLiveDetail(upperCode),
      fetchTefasPriceHistory(upperCode, days),
    ]);

    const baseFund = getFundByCode(upperCode);
    const fund = liveDetail || baseFund;
    if (!fund) {
      return NextResponse.json(
        { success: false, error: 'Fon bulunamadı' },
        { status: 404 }
      );
    }

    let history = realHistory;

    // If real history is returned from TEFAS API, ensure the latest price and daily return sync
    if (history && history.length > 0) {
      const lastPoint = history[history.length - 1];
      const prevPoint = history.length > 1 ? history[history.length - 2] : lastPoint;
      
      fund.price = lastPoint.price;
      if (!liveDetail) {
        fund.dailyReturn = Number((((lastPoint.price - prevPoint.price) / prevPoint.price) * 100).toFixed(2));
      }
    } else {
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
