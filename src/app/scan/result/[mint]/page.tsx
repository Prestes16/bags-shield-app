'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Shield, AlertTriangle, ArrowRightLeft, ExternalLink } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function ScanResultPage() {
  const params = useParams();
  const { connected, publicKey } = useWallet();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [swapLoading, setSwapLoading] = useState(false);

  const mint = typeof params.mint === 'string' ? params.mint : '';

  useEffect(() => {
    if (!mint) return;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint })
        });
        const json = await res.json();
        
        if (json.success) {
          setData(json.response);
        } else {
          console.error("Scan Failed:", json.error);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mint]);

  const handleSwap = async () => {
    if (!connected || !publicKey) return;
    setSwapLoading(true);
    try {
      alert("Módulo Swap: Conectando com Jupiter V6... (Funcionalidade vindo no próximo patch)");
    } catch (e) {
      alert("Erro no Swap");
    } finally {
      setSwapLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-[#020617] flex items-center justify-center text-cyan-400'>
        <Shield className='w-12 h-12 animate-pulse' />
        <span className='ml-4 text-lg font-bold'>Analisando Blockchain...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white'>
        <AlertTriangle className='w-16 h-16 text-red-500 mb-4' />
        <h1 className='text-2xl font-bold'>Token não encontrado</h1>
        <p className='text-gray-400 mt-2'>A API Helius não retornou dados para este mint.</p>
      </div>
    );
  }

  const { tokenInfo, security, findings } = data;
  const scoreColor = security.score > 70 ? 'text-green-400' : security.score > 40 ? 'text-yellow-400' : 'text-red-500';

  return (
    <div className='min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 font-sans'>
      
      <header className='max-w-4xl mx-auto flex justify-between items-center mb-8'>
        <div className='flex items-center gap-2'>
          <Shield className='w-8 h-8 text-cyan-400' />
          <span className='text-xl font-bold tracking-tight'>Bags Shield</span>
        </div>
        <WalletMultiButton style={{ backgroundColor: '#06b6d4', borderRadius: '12px' }} />
      </header>

      <main className='max-w-4xl mx-auto'>
        <div className='bg-[#0f172a] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden'>
          
          <div className='absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none'></div>

          <div className='flex flex-col md:flex-row gap-8 items-start relative z-10'>
            
            <div className='relative'>
              {tokenInfo.image ? (
                <img 
                  src={tokenInfo.image} 
                  alt={tokenInfo.name} 
                  className='w-32 h-32 rounded-full object-cover border-4 border-slate-700 shadow-lg'
                />
              ) : (
                <div className='w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700'>
                  <span className='text-4xl'>?</span>
                </div>
              )}
              <div className={'absolute -bottom-2 -right-2 w-12 h-12 flex items-center justify-center rounded-full bg-[#0f172a] border-4 border-[#0f172a] ' + scoreColor + ' font-black text-lg'}>
                 {security.grade || '?'}
              </div>
            </div>

            <div className='flex-1'>
              <h1 className='text-3xl md:text-4xl font-bold text-white mb-2'>{tokenInfo.name}</h1>
              <div className='flex items-center gap-3 text-slate-400 mb-6'>
                <span className='bg-slate-800 px-3 py-1 rounded-md text-sm font-mono'>{tokenInfo.symbol}</span>
                <span className='text-sm truncate max-w-[200px] opacity-60'>{mint}</span>
                <a href={'https://solscan.io/token/' + mint} target="_blank" rel="noreferrer" className='text-cyan-400 hover:text-cyan-300'>
                  <ExternalLink className='w-4 h-4' />
                </a>
              </div>

              <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
                <div className='bg-slate-900/50 p-3 rounded-lg border border-slate-800'>
                  <div className='text-xs text-slate-500 uppercase font-bold mb-1'>Shield Score</div>
                  <div className={'text-2xl font-bold ' + scoreColor}>{security.score}/100</div>
                </div>
                <div className='bg-slate-900/50 p-3 rounded-lg border border-slate-800'>
                  <div className='text-xs text-slate-500 uppercase font-bold mb-1'>Mint Auth</div>
                  <div className={security.mintAuthority ? 'text-red-400' : 'text-green-400 font-bold'}>
                    {security.mintAuthority ? 'Ativo ⚠️' : 'Revogado ✅'}
                  </div>
                </div>
                <div className='bg-slate-900/50 p-3 rounded-lg border border-slate-800'>
                  <div className='text-xs text-slate-500 uppercase font-bold mb-1'>Freeze Auth</div>
                  <div className={security.freezeAuthority ? 'text-red-400' : 'text-green-400 font-bold'}>
                    {security.freezeAuthority ? 'Ativo ⚠️' : 'Revogado ✅'}
                  </div>
                </div>
              </div>

              {connected ? (
                <button 
                  onClick={handleSwap}
                  disabled={swapLoading || !security.isSafe}
                  className={'w-full md:w-auto px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ' +
                    (!security.isSafe 
                      ? 'bg-red-900/20 text-red-500 border border-red-900 cursor-not-allowed' 
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20')}
                >
                  {swapLoading ? (
                    'Preparando Jupiter...' 
                  ) : !security.isSafe ? (
                    'Swap Bloqueado (Alto Risco)'
                  ) : (
                    'Swap via Jupiter'
                  )}
                </button>
              ) : (
                <div className='text-slate-500 text-sm'>
                  Conecte sua carteira para habilitar o Swap.
                </div>
              )}

            </div>
          </div>
        </div>

        {findings.length > 0 && (
          <div className='mt-8'>
            <h3 className='text-xl font-bold mb-4 text-slate-300'>Relatório de Risco</h3>
            <div className='space-y-3'>
              {findings.map((f, i) => (
                <div key={i} className={'p-4 rounded-lg border flex items-center gap-3 ' + (
                  f.type === 'warning' ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-200' :
                  f.type === 'error' ? 'bg-red-900/10 border-red-900/30 text-red-200' :
                  'bg-blue-900/10 border-blue-900/30 text-blue-200'
                )}>
                  <AlertTriangle className='w-5 h-5 shrink-0' />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}