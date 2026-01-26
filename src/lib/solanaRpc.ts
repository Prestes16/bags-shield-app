/**
 * Solana RPC client (lightweight, no dependencies)
 * SSR-safe: uses fetch only
 */

import { validateBackendUrl } from "./urlValidation";

export interface SolanaRpcConfig {
  rpcUrl: string;
  timeoutMs?: number;
}

export interface MintAccountInfo {
  mint: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
}

export interface TokenAccountInfo {
  address: string;
  amount: string;
  decimals: number;
}

/**
 * Parse SPL Token Mint account layout
 * Layout: https://spl.solana.com/token#mint
 */
function parseMintAccount(data: Uint8Array | Buffer): MintAccountInfo | null {
  try {
    if (data.length < 82) return null;

    // Mint layout (82 bytes):
    // - option<Pubkey> mint_authority (1 + 32 = 33 bytes)
    // - u64 supply (8 bytes)
    // - u8 decimals (1 byte)
    // - bool is_initialized (1 byte)
    // - option<Pubkey> freeze_authority (1 + 32 = 33 bytes)

    let offset = 0;

    // mint_authority (Option<Pubkey>)
    const mintAuthorityOption = data[offset];
    offset += 1;
    let mintAuthority: string | null = null;
    if (mintAuthorityOption === 1) {
      const pubkeyBytes = data.slice(offset, offset + 32);
      // Use Buffer if available (Node.js), otherwise simplified identifier
      if (typeof Buffer !== "undefined") {
        mintAuthority = Buffer.from(pubkeyBytes).toString("base64").slice(0, 12);
      } else {
        // Fallback: use first bytes as identifier
        mintAuthority = Array.from(pubkeyBytes.slice(0, 4))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
      offset += 32;
    } else {
      offset += 32; // Skip null pubkey
    }

    // supply (u64, little-endian)
    const supplyBytes = data.slice(offset, offset + 8);
    let supplyValue = 0n;
    for (let i = 0; i < 8; i++) {
      supplyValue += BigInt(supplyBytes[i]) << BigInt(i * 8);
    }
    const supply = supplyValue.toString();
    offset += 8;

    // decimals (u8)
    const decimals = data[offset];
    offset += 1;

    // is_initialized (bool, skip)
    offset += 1;

    // freeze_authority (Option<Pubkey>)
    const freezeAuthorityOption = data[offset];
    offset += 1;
    let freezeAuthority: string | null = null;
    if (freezeAuthorityOption === 1) {
      const pubkeyBytes = data.slice(offset, offset + 32);
      if (typeof Buffer !== "undefined") {
        freezeAuthority = Buffer.from(pubkeyBytes).toString("base64").slice(0, 12);
      } else {
        freezeAuthority = Array.from(pubkeyBytes.slice(0, 4))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    }

    return {
      mint: "", // Will be set by caller
      mintAuthority,
      freezeAuthority,
      supply,
      decimals,
    };
  } catch {
    return null;
  }
}


/**
 * Fetch mint account info from Solana RPC
 */
export async function fetchMintAccount(
  mint: string,
  config: SolanaRpcConfig
): Promise<MintAccountInfo | null> {
  // SSRF Protection: validate RPC URL
  const urlValidation = validateBackendUrl(config.rpcUrl, { kind: "rpc" });
  if (!urlValidation.valid) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 10_000);

  try {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [
          mint,
          {
            encoding: "base64",
          },
        ],
      }),
      redirect: "manual", // ✅ CRÍTICO: bloqueia redirects SSRF
      signal: controller.signal,
    });

    // ✅ Se RPC tentar redirecionar, bloqueia
    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timeout);
      return null; // RPC redirect bloqueado
    }

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    if (!data?.result?.value?.data) return null;

    const accountData = Array.isArray(data.result.value.data)
      ? data.result.value.data[0]
      : data.result.value.data;

    if (!accountData) return null;

    // Convert base64 to Buffer/Uint8Array
    let bytes: Uint8Array | Buffer;
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(accountData, "base64");
    } else {
      // Fallback for environments without Buffer
      const binaryString = atob(accountData);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    }

    const parsed = parseMintAccount(bytes);

    if (parsed) {
      parsed.mint = mint;
    }

    return parsed;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Fetch largest token accounts for concentration calculation
 */
export async function fetchLargestAccounts(
  mint: string,
  config: SolanaRpcConfig
): Promise<TokenAccountInfo[]> {
  // SSRF Protection: validate RPC URL
  const urlValidation = validateBackendUrl(config.rpcUrl, { kind: "rpc" });
  if (!urlValidation.valid) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 10_000);

  // Use validated/normalized URL
  const rpcUrl = urlValidation.normalized || config.rpcUrl;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getTokenLargestAccounts",
        params: [mint],
      }),
      redirect: "manual", // ✅ CRÍTICO: bloqueia redirects SSRF
      signal: controller.signal,
    });

    // ✅ Se RPC tentar redirecionar, bloqueia
    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timeout);
      return []; // RPC redirect bloqueado
    }

    clearTimeout(timeout);

    if (!response.ok) return [];

    const data = await response.json().catch(() => null);
    if (!data?.result?.value || !Array.isArray(data.result.value)) return [];

    return data.result.value.map((acc: any) => ({
      address: acc.address || "",
      amount: acc.uiAmountString || acc.amount || "0",
      decimals: 0, // Will be set from mint info
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/**
 * Calculate top 10 holder concentration percentage
 */
export function calculateTop10Concentration(
  largestAccounts: TokenAccountInfo[],
  totalSupply: string
): number | null {
  if (largestAccounts.length === 0 || !totalSupply) return null;

  try {
    const total = BigInt(totalSupply);
    if (total === 0n) return null;

    const top10 = largestAccounts.slice(0, 10);
    let top10Total = 0n;

    for (const acc of top10) {
      try {
        const amount = BigInt(acc.amount);
        top10Total += amount;
      } catch {
        // Skip invalid amounts
      }
    }

    const percentage = Number((top10Total * 10000n) / total) / 100;
    return Math.min(100, Math.max(0, percentage));
  } catch {
    return null;
  }
}
