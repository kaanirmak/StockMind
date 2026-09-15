import { NextResponse } from 'next/server';
import { getAllFunds } from '@/lib/data/funds';
import { fetchTefasLiveDetail } from '@/lib/api/tefas';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const minRisk = searchParams.get('minRisk') ? Number(searchParams.get('minRisk')) : undefined;
    const maxRisk = searchParams.get('maxRisk') ? Number(searchParams.get('maxRisk')) : undefined;

    let funds = getAllFunds({ category, search, minRisk, maxRisk });

    // If search is a specific symbol search, enrich top matches with live official TEFAS data
    if (search && search.trim().length > 0 && funds.length > 0 && funds.length <= 15) {
      const topCandidates = funds.slice(0, 6);
      const liveUpdates = await Promise.all(
        topCandidates.map(async (f) => {
          try {
            const live = await fetchTefasLiveDetail(f.code);
            return live ? { code: f.code, live } : null;
          } catch {
            return null;
          }
        })
      );

      const liveMap = new Map();
      for (const update of liveUpdates) {
        if (update?.live) {
          liveMap.set(update.code, update.live);
        }
      }

      if (liveMap.size > 0) {
        funds = funds.map((f) => liveMap.get(f.code) || f);
      }
    }

    return NextResponse.json({
      success: true,
      count: funds.length,
      data: funds,
    });
  } catch (error) {
    console.error('Funds API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Fon verileri alınamadı' },
      { status: 500 }
    );
  }
}
