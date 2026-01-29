"use client";
import React from "react";

type Props = {
  mint?: string;
  pro?: boolean;
  signature?: string;
};

export default function ScanLoadingClient({ mint, pro, signature }: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
        <div className="text-sm text-slate-300">Scanning…</div>
        <div className="mt-2 text-lg font-semibold text-slate-100">Preparing results</div>

        {(mint || signature || pro) && (
          <div className="mt-4 text-xs text-slate-400 space-y-1">
            {mint && <div><span className="text-slate-500">mint:</span> {mint}</div>}
            {typeof pro === "boolean" && <div><span className="text-slate-500">pro:</span> {String(pro)}</div>}
            {signature && <div><span className="text-slate-500">sig:</span> {signature.slice(0, 10)}…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
