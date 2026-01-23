/**
 * Token metadata type
 * Used across scan/watchlist/history to represent token information
 */
export interface TokenMeta {
  mint: string;
  symbol?: string;
  name?: string;
  imageUrl?: string; // Only present if backend provides it
}

/**
 * Extract token metadata from backend response
 */
export function extractTokenMeta(response: any): TokenMeta | null {
  if (!response) return null;

  // Try various response shapes
  const mint = response.mint || response.tokenMint || null;
  if (!mint) return null;

  return {
    mint,
    symbol: response.symbol || response.tokenSymbol || undefined,
    name: response.name || response.tokenName || undefined,
    imageUrl: response.imageUrl || response.logoURI || response.image || undefined,
  };
}
