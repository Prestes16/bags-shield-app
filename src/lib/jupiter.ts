/**
 * Jupiter Aggregator integration
 * Config-driven, no hardcoded endpoints
 * Note: Feature flag checks should be done in API routes (server-side)
 */

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string; // In smallest unit (lamports)
  slippageBps?: number; // Basis points (default: 50 = 0.5%)
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number; // App fee in basis points (0-100 = 0-1%)
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  feeAccount?: string; // Initialized token account (ATA) for input/output mint (required when platformFeeBps > 0)
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Get Jupiter API base URL from config
 */
function getJupiterBaseUrl(): string {
  const baseUrl = process.env.JUPITER_API_BASE || 
                  process.env.JUPITER_API_BASE ||
                  "https://api.jup.ag";
  
  // Remove trailing slash
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Get Jupiter quote
 */
export async function getJupiterQuote(
  request: JupiterQuoteRequest
): Promise<{ success: true; data: JupiterQuoteResponse } | { success: false; error: string }> {
  // Feature flag check is done in API route (server-side)
  const baseUrl = getJupiterBaseUrl();
  const slippageBps = request.slippageBps ?? 50; // Default 0.5%

  const params = new URLSearchParams({
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    amount: request.amount,
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: (request.onlyDirectRoutes ?? false).toString(),
    asLegacyTransaction: (request.asLegacyTransaction ?? false).toString(),
  });

  // Add platform fee if provided
  if (request.platformFeeBps !== undefined && request.platformFeeBps > 0) {
    params.append("platformFeeBps", request.platformFeeBps.toString());
  }

  try {
    const response = await fetch(`${baseUrl}/quote?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Jupiter API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch Jupiter quote",
    };
  }
}

/**
 * Get Jupiter swap transaction
 */
export async function getJupiterSwap(
  request: JupiterSwapRequest
): Promise<{ success: true; data: JupiterSwapResponse } | { success: false; error: string }> {
  // Feature flag check is done in API route (server-side)
  const baseUrl = getJupiterBaseUrl();

  const body: any = {
    quoteResponse: request.quoteResponse,
    userPublicKey: request.userPublicKey,
    wrapAndUnwrapSol: request.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: request.dynamicComputeUnitLimit ?? true,
    prioritizationFeeLamports: request.prioritizationFeeLamports,
    asLegacyTransaction: request.asLegacyTransaction ?? false,
  };

  // Add fee account if provided (Jupiter expects feeAccount in swap request)
  if (request.feeAccount) {
    body.feeAccount = request.feeAccount;
  }

  try {
    const response = await fetch(`${baseUrl}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Jupiter API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to get Jupiter swap transaction",
    };
  }
}

/**
 * Calculate minimum output amount with slippage
 */
export function calculateMinOut(
  outAmount: string,
  slippageBps: number
): string {
  const amount = BigInt(outAmount);
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minOut = (amount * slippageMultiplier) / BigInt(10000);
  return minOut.toString();
}

/**
 * Format slippage percentage
 */
export function formatSlippageBps(slippageBps: number): string {
  return `${(slippageBps / 100).toFixed(2)}%`;
}
