import { VersionedTransaction } from '@solana/web3.js';

export const buildSwapTransactionOnly = async (
  quoteResponse: any, 
  userPublicKey: string,
  isSafe: boolean
): Promise<VersionedTransaction> => {
  
  // 1. Risk Guard (Fail-Closed)
  if (!isSafe) {
    throw new Error("SECURITY_BLOCK: Risco detectado. Swap bloqueado pelo Bags Shield.");
  }

  // 2. Fetch no Backend Próprio (Proxy Seguro)
  const response = await fetch('/api/jupiter/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteResponse, userPublicKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao construir transação no servidor');
  }

  const { swapTransaction } = await response.json();

  // 3. Luna Check: Reconstrução Segura (Base64 -> Buffer -> Objeto)
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  return transaction;
};
