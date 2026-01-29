"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WebacyTradingLite {
  // Add fields based on actual Webacy API response structure
  [key: string]: any;
}

interface WebacyHolderAnalysis {
  // Add fields based on actual Webacy API response structure
  [key: string]: any;
}

interface WebacySignalsProps {
  mint: string;
  className?: string;
}

export function WebacySignals({ mint, className }: WebacySignalsProps) {
  const [tradingLite, setTradingLite] = useState<{
    data: WebacyTradingLite | null;
    loading: boolean;
    error: string | null;
    cached: boolean;
  }>({
    data: null,
    loading: false,
    error: null,
    cached: false,
  });

  const [holderAnalysis, setHolderAnalysis] = useState<{
    data: WebacyHolderAnalysis | null;
    loading: boolean;
    error: string | null;
    cached: boolean;
  }>({
    data: null,
    loading: false,
    error: null,
    cached: false,
  });

  const [expanded, setExpanded] = useState(false);
  const [holderAnalysisExpanded, setHolderAnalysisExpanded] = useState(false);

  const hasTriedRef = useRef(false);

  // Load trading-lite automatically when component mounts (1x per session, no cascade)
  useEffect(() => {
    if (!mint) return;
    if (hasTriedRef.current) return;
    hasTriedRef.current = true;

    const loadTradingLite = async () => {
      setTradingLite((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(`/api/dd/trading-lite?mint=${encodeURIComponent(mint)}&chain=sol`);
        const result = await response.json();

        if (result.success && result.response?.tradingLite) {
          setTradingLite({
            data: result.response.tradingLite,
            loading: false,
            error: null,
            cached: result.meta?.cached === true,
          });
          return;
        }

        if (result.meta?.upstreamStatus === 412 || result.meta?.upstreamStatus === 503) {
          setTradingLite({
            data: null,
            loading: false,
            error: null,
            cached: false,
          });
          return;
        }

        setTradingLite({
          data: null,
          loading: false,
          error: result.error || "Failed to load Webacy data",
          cached: false,
        });
      } catch (err: any) {
        setTradingLite({
          data: null,
          loading: false,
          error: err?.message || "Network error",
          cached: false,
        });
      }
    };

    loadTradingLite();
  }, [mint]);

  const [holderAnalysisRestricted, setHolderAnalysisRestricted] = useState(false);

  // Load holder-analysis only when button is clicked (lazy loading)
  const loadHolderAnalysis = useCallback(async () => {
    if (holderAnalysis.data || holderAnalysis.loading || holderAnalysisRestricted) {
      return; // Already loaded, loading, or restricted
    }

    setHolderAnalysis((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/dd/holder-analysis?mint=${encodeURIComponent(mint)}&chain=sol`);
      const result = await response.json();

      if (result.success) {
        // Check if restricted/premium (available: false or meta.restricted: true)
        if (result.meta?.restricted === true || result.response?.available === false) {
          setHolderAnalysisRestricted(true);
          setHolderAnalysis({
            data: null,
            loading: false,
            error: null,
            cached: result.meta?.cached === true,
          });
        } else if (result.response?.holderAnalysis) {
          setHolderAnalysis({
            data: result.response.holderAnalysis,
            loading: false,
            error: null,
            cached: result.meta?.cached === true,
          });
          setHolderAnalysisExpanded(true);
        } else {
          setHolderAnalysis({
            data: null,
            loading: false,
            error: null,
            cached: false,
          });
        }
      } else {
        if (result.meta?.upstreamStatus === 412 || result.meta?.upstreamStatus === 503) {
          setHolderAnalysis({
            data: null,
            loading: false,
            error: null,
            cached: false,
          });
          return;
        }
        setHolderAnalysis({
          data: null,
          loading: false,
          error: result.error || "Failed to load holder analysis",
          cached: false,
        });
      }
    } catch (err: any) {
      setHolderAnalysis({
        data: null,
        loading: false,
        error: err?.message || "Network error",
        cached: false,
      });
    }
  }, [mint, holderAnalysis.data, holderAnalysis.loading, holderAnalysisRestricted]);

  // Don't render if Webacy is disabled or not configured (no error state)
  if (!tradingLite.loading && !tradingLite.data && !tradingLite.error) {
    return null; // Webacy disabled/not configured - silently hide
  }

  // Don't render if there's an error (unless it's a network error)
  if (tradingLite.error && !tradingLite.data) {
    return null; // Hide on error (user doesn't need to see Webacy errors)
  }

  return (
    <div className={cn("rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-semibold">Webacy Signals</h3>
          {tradingLite.cached && (
            <span className="text-xs text-muted-foreground">(cached)</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Trading Lite Summary */}
          {tradingLite.loading ? (
            <div className="text-xs text-muted-foreground">Loading trading signals...</div>
          ) : tradingLite.data ? (
            <div className="rounded-xl border border-surface/50 bg-surface/20 p-3">
              <div className="text-xs font-medium mb-2">Trading Signals</div>
              <div className="text-xs text-muted-foreground">
                {typeof tradingLite.data === "object" ? (
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(tradingLite.data, null, 2)}
                  </pre>
                ) : (
                  String(tradingLite.data)
                )}
              </div>
            </div>
          ) : null}

          {/* Holder Analysis - Lazy Load */}
          <div className="rounded-xl border border-surface/50 bg-surface/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium">Holder Analysis</div>
              {holderAnalysis.cached && !holderAnalysisRestricted && (
                <span className="text-xs text-muted-foreground">(cached)</span>
              )}
            </div>
            {holderAnalysisRestricted ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                <span className="text-amber-400">🔒</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-300">Premium Feature</div>
                  <div className="text-xs text-amber-200/80 mt-0.5">
                    Holder Analysis is not available in demo mode
                  </div>
                </div>
              </div>
            ) : holderAnalysis.loading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : holderAnalysis.data ? (
              <div className="text-xs text-muted-foreground">
                {typeof holderAnalysis.data === "object" ? (
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(holderAnalysis.data, null, 2)}
                  </pre>
                ) : (
                  String(holderAnalysis.data)
                )}
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={loadHolderAnalysis}
                className="w-full mt-2"
              >
                Load Holder Analysis
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
