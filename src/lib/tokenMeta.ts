/**
 * Token metadata type
 * Used across scan/watchlist/history to represent token information
 */
export interface TokenMeta {
  metadataSource?: string; // 'das' | 'onchain' | 'backend' | etc.
  mint: string;
  symbol?: string;
  name?: string;
  imageUrl?: string; // Only present if backend provides it
}

/**
 * Extract token metadata from backend response
 * Accepts both (a) tokenMeta object or (b) raw complete response
 * Priority for image: imageUrl > logoURI > image > asset links
 */
export function extractTokenMeta(response: any): TokenMeta | null {
  if (!response) return null;

  // Try various response shapes
  const mint = response.mint || response.tokenMint || null;
  if (!mint) return null;

  // Priority: imageUrl > logoURI > image > content.links.image
  let imageUrl: string | undefined;
  if (response.imageUrl) {
    imageUrl = response.imageUrl;
  } else if (response.logoURI) {
    imageUrl = response.logoURI;
  } else if (response.image) {
    imageUrl = response.image;
  } else if (response.content?.links?.image) {
    imageUrl = response.content.links.image;
  }

  // Extract name and symbol with fallbacks
  const name =
    response.name || response.tokenName || response.content?.metadata?.name;
  const symbol =
    response.symbol ||
    response.tokenSymbol ||
    response.content?.metadata?.symbol ||
    response.token_info?.symbol;

  // Never return undefined if we have mint - at least return mint with fallback values
  return {
    mint,
    symbol: symbol || undefined,
    name: name || undefined,
    imageUrl: imageUrl || undefined,
  };
}
