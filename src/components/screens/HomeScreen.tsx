"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { connectWallet } from "@/lib/wallet";

export default function HomeScreen() {
  const router = useRouter();
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Botão Search: navegar para /search (que redireciona para /scan)
  const handleSearch = () => {
    router.push("/search"); // Redireciona para /scan
  };

  // Botão Connect Wallet: tentar conectar wallet real
  const handleConnectWallet = async () => {
    setWalletError(null);
    const result = await connectWallet();
    
    if (result.ok) {
      setIsWalletConnected(true);
      // Após conectar, redirecionar para o Dashboard
      router.push("/dashboard");
    } else {
      setWalletError(result.error || "Falha ao conectar wallet.");
      // Se não tiver wallet, ainda permite navegar (modo demo)
      // ou mostra erro para o usuário
    }
  };

  // Botão Quick Scan: levar diretamente para página de input de Mint Address
  const handleQuickScan = () => {
    router.push("/scan"); // Tela 7/8: Scan input para iniciar análise
  };

  // Navegação do Bottom Nav
  const handleBottomNavSearch = () => {
    router.push("/search"); // Redireciona para /scan
  };

  const handleBottomNavHistory = () => {
    router.push("/history"); // Tela 14: History
  };

  const handleBottomNavSettings = () => {
    router.push("/settings"); // Tela 18: Settings
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12">
              <Image
                src="/images/bags-shield-icon.png"
                alt="Bags Shield Logo"
                fill
                className="rounded-lg object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  if (target.parentElement) {
                    target.parentElement.innerHTML = "🛡️";
                  }
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Bags Shield</h1>
              <p className="text-sm text-slate-400">Security Gateway for Solana</p>
            </div>
          </div>

          {/* Botão Search */}
          <Button
            onClick={handleSearch}
            variant="outline"
            className="bg-card/40 border-border/40 text-foreground hover:bg-card/55"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Search
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center gap-8">
        {/* Hero Section */}
        <div className="text-center max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Secure Your Solana Trades
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Analyze token risks, simulate transactions, and protect your investments with real-time security insights.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {/* Botão Connect Wallet */}
          {walletError && (
            <div className="w-full text-sm text-red-400 text-center mb-2">
              {walletError}
            </div>
          )}
          <Button
            onClick={handleConnectWallet}
            disabled={isWalletConnected}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold shadow-[0_0_20px_rgba(6,182,212,0.5)]"
          >
            {isWalletConnected ? (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Conectado
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Connect Wallet
              </>
            )}
          </Button>

          {/* Botão Quick Scan */}
          <Button
            onClick={handleQuickScan}
            variant="outline"
            className="flex-1 bg-card/40 border-border/40 text-foreground hover:bg-card/55"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            Quick Scan
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-8">
          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 hover:bg-card/55 transition-colors">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Token Analysis</h3>
            <p className="text-sm text-slate-400">
              Real-time risk scoring and security analysis for Solana tokens.
            </p>
          </div>

          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 hover:bg-card/55 transition-colors">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Transaction Simulation</h3>
            <p className="text-sm text-slate-400">
              Test transactions before execution to avoid costly mistakes.
            </p>
          </div>

          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 hover:bg-card/55 transition-colors">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Alerts</h3>
            <p className="text-sm text-slate-400">
              Get notified about token score changes and risk updates.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="border-t border-border/40 bg-background sticky bottom-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-around">
            {/* Ícone Lupa -> /search */}
            <button
              onClick={handleBottomNavSearch}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors"
              aria-label="Search"
            >
              <svg
                className="w-6 h-6 text-slate-400 hover:text-cyan-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="text-xs text-slate-400">Search</span>
            </button>

            {/* Ícone Relógio -> /history */}
            <button
              onClick={handleBottomNavHistory}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors"
              aria-label="History"
            >
              <svg
                className="w-6 h-6 text-slate-400 hover:text-cyan-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs text-slate-400">History</span>
            </button>

            {/* Ícone Engrenagem -> /settings */}
            <button
              onClick={handleBottomNavSettings}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors"
              aria-label="Settings"
            >
              <svg
                className="w-6 h-6 text-slate-400 hover:text-cyan-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-xs text-slate-400">Settings</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
