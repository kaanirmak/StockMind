import { NextResponse } from 'next/server';
import { getFundsFromDatabase, getAllFunds } from '@/lib/data/funds';
import { fetchTefasLiveDetail } from '@/lib/api/tefas';
import {
  filterFundsCombinatorially,
  sortFundsByField,
  type FundFeeTier,
  type FundReturnPeriod,
  type FundReturnThreshold,
  type FundRiskRange,
} from '@/lib/market/fundFilters';
import { paginateRecords, parsePaginationParams } from '@/lib/market/pagination';
import { parseSymbolListParam } from '@/lib/market/symbolQuery';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const requestedSymbols = parseSymbolListParam(searchParams.get('symbols'));
    const minRisk = searchParams.get('minRisk') ? Number(searchParams.get('minRisk')) : undefined;
    const maxRisk = searchParams.get('maxRisk') ? Number(searchParams.get('maxRisk')) : undefined;
    const riskRange = (searchParams.get('riskRange') as FundRiskRange) || undefined;
    const feeTier = (searchParams.get('feeTier') as FundFeeTier) || undefined;
    const maxFee = searchParams.get('maxFee') ? Number(searchParams.get('maxFee')) : undefined;
    const returnPeriod = (searchParams.get('returnPeriod') as FundReturnPeriod) || undefined;
    const returnThreshold = (searchParams.get('returnThreshold') as FundReturnThreshold) || undefined;
    const minReturn = searchParams.get('minReturn') ? Number(searchParams.get('minReturn')) : undefined;
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

    if (requestedSymbols.length > 0) {
      const allowed = new Set(requestedSymbols);
      funds = funds.filter((f) => allowed.has(String(f.code || '').toUpperCase()));
    }

    // If searching or fetching a small symbol-scoped watch/alert list, enrich candidates with live TEFAS API
    if (((search && search.trim().length > 0) || (requestedSymbols.length > 0 && funds.length <= 20)) && funds.length > 0) {
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

    if (
      (riskRange && riskRange !== 'ALL') ||
      (feeTier && feeTier !== 'ALL') ||
      maxFee !== undefined ||
      (returnThreshold && returnThreshold !== 'ALL') ||
      minReturn !== undefined
    ) {
      funds = filterFundsCombinatorially(funds, {
        riskRange,
        minRisk,
        maxRisk,
        feeTier,
        maxFee,
        returnPeriod,
        returnThreshold,
        minReturn,
      });
    }

    // Apply sorting consistently across pages when requested
    if (sortBy) {
      funds = sortFundsByField(funds, sortBy as any, order);
    }

    const { page, limit: parsedLimit } = parsePaginationParams(searchParams);
    const paginated = paginateRecords(funds, page, parsedLimit);

    return NextResponse.json({
      success: true,
      count: paginated.items.length,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
      hasMore: paginated.hasMore,
      data: paginated.items,
    });
  } catch (error) {
    console.error('Funds API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Fon verileri alınamadı' },
      { status: 500 }
    );
  }
}
