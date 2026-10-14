import { NextResponse } from 'next/server';
import { getFundsFromDatabase, getAllFunds } from '@/lib/data/funds';
import { fetchTefasLiveDetail } from '@/lib/api/tefas';
export const dynamic = 'force-dynamic';

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

    // 1. Fetch from Supabase Database
    const dbFunds = await getFundsFromDatabase({
      category,
      search,
      minRisk,
      maxRisk,
      sortBy,
      order,
      limit,
    });

    // 2. Base directory of all registered TEFAS funds (1051+ funds)
    const allDirectoryFunds = getAllFunds({ category, search, minRisk, maxRisk });

    // 3. Merge: Directory provides the complete registry, DB funds override with live synced metrics
    const fundMap = new Map();
    for (const f of allDirectoryFunds) {
      fundMap.set(f.code.toUpperCase(), f);
    }
    for (const f of dbFunds) {
      fundMap.set(f.code.toUpperCase(), f);
    }

    let funds = Array.from(fundMap.values());

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

    // Apply sorting if requested
    if (sortBy) {
      const mult = order === 'asc' ? 1 : -1;
      funds.sort((a: any, b: any) => {
        const valA = a[sortBy] != null ? Number(a[sortBy]) : -Infinity * mult;
        const valB = b[sortBy] != null ? Number(b[sortBy]) : -Infinity * mult;
        if (valA === valB) return 0;
        return (valA - valB) * mult;
      });
    }

    const totalCount = funds.length;
    const page = searchParams.get('page') ? Math.max(1, Number(searchParams.get('page')) || 1) : 1;
    const parsedLimit = limit && limit > 0 ? limit : undefined;
    const pagedFunds = parsedLimit ? funds.slice((page - 1) * parsedLimit, page * parsedLimit) : funds;

    return NextResponse.json({
      success: true,
      count: pagedFunds.length,
      total: totalCount,
      page,
      limit: parsedLimit || totalCount,
      data: pagedFunds,
    });
  } catch (error) {
    console.error('Funds API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Fon verileri alınamadı' },
      { status: 500 }
    );
  }
}
