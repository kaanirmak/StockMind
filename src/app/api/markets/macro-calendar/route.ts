import { NextResponse } from 'next/server';
import {
  fetchMacroCalendarEvents,
  type MacroRegion,
} from '@/lib/market/macroCalendar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawRegion = (searchParams.get('region') || 'ALL').trim().toUpperCase();
    const region: MacroRegion =
      rawRegion === 'TR' || rawRegion === 'GLOBAL' ? rawRegion : 'ALL';

    const report = await fetchMacroCalendarEvents({ region });
    return NextResponse.json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('Macro calendar API error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unavailable',
        events: [],
        error: 'Makroekonomi takvimi alınamadı.',
      },
      { status: 500 }
    );
  }
}

