import { NextResponse } from 'next/server';
import { getFundsFromDatabase, getAllFunds } from '@/lib/data/funds';
import { fetchTefasLiveDetail } from '@/lib/api/tefas';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const minRisk = searchParams.get('minRisk') ? Number(searchParams.get('minRisk')) : undefined;
    const maxRisk = searchParams.get('maxRisk') ? Number(searchParams.get('maxRisk')) : undefined;
    const sortBy = searchParams.get('sortBy') || undefined;
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

    // 1. Try fetching from Supabase Database (100% Real Synchronized Data)
    let funds = await getFundsFromDatabase({
      category,
      search,
      minRisk,
      maxRisk,
      sortBy,
      order,
      limit,
    });

    // 2. If DB has not been populated yet or returns empty, fallback to directory + live enrichment
    if (!funds || funds.length === 0) {
      funds = getAllFunds({ category, search, minRisk, maxRisk });

      // If searching, enrich top candidates with live TEFAS API
      if (search && search.trim().length > 0 && funds.length > 0) {
        const topCandidates = funds.slice(0, 8);
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
