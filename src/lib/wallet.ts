export async function connectWallet() {
  const w = window as any;
  const provider = w?.solana;

  if (!provider) {
    return { ok: false, error: "Nenhuma wallet detectada no navegador." };
  }

  try {
    const res = await provider.connect?.();
    const pubkey =
      res?.publicKey?.toString?.() ||
      provider.publicKey?.toString?.();

    if (!pubkey) return { ok: false, error: "Conectou, mas não retornou publicKey." };

    return { ok: true, address: pubkey };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao conectar wallet." };
  }
}
