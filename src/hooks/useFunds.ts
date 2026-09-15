'use client';

import { useState, useEffect, useCallback } from 'react';
import { TefasFundInfo } from '@/lib/data/funds';

export function useFunds(filter?: {
  category?: string;
  search?: string;
  minRisk?: number;
  maxRisk?: number;
}) {
  const [funds, setFunds] = useState<TefasFundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunds = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter?.category && filter.category !== 'ALL') params.append('category', filter.category);
      if (filter?.search) params.append('search', filter.search);
      if (filter?.minRisk) params.append('minRisk', String(filter.minRisk));
      if (filter?.maxRisk) params.append('maxRisk', String(filter.maxRisk));

      const res = await fetch(`/api/funds?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setFunds(json.data);
      } else {
        setError(json.error || 'Fonlar yüklenemedi');
      }
    } catch (err) {
      setError('Ağ hatası oluştu');
    } finally {
      setLoading(false);
    }
  }, [filter?.category, filter?.search, filter?.minRisk, filter?.maxRisk]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { funds, loading, error, refetch: fetchFunds };
}

export function useFundDetail(code: string, days: number = 90) {
  const [fund, setFund] = useState<(TefasFundInfo & { history: { date: string; price: number }[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/funds/${code}?days=${days}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success) {
            setFund(json.data);
          } else {
            setError(json.error || 'Fon bulunamadı');
          }
        }
      } catch (err) {
        if (isMounted) setError('Ağ hatası oluştu');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [code, days]);

  return { fund, loading, error };
}
