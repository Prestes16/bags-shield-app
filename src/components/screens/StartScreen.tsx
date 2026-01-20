"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function StartScreen() {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Animação rápida (1.5s) e redireciona para /home
    const timer = setTimeout(() => {
      setIsAnimating(false);
      router.push("/home");
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center relative">
      <div className="text-center relative z-10">
        {/* Logo com animação de entrada */}
        <div
          className={`mb-8 transition-all duration-700 mx-auto ${
            isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="relative w-32 h-32 mx-auto mb-4">
            <Image
              src="/images/bags-shield-icon.png"
              alt="Bags Shield Logo"
              fill
              className="rounded-2xl object-contain"
              priority
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<span class="text-6xl">🛡️</span>';
                }
              }}
            />
            
            {/* Glow effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
              <div className="w-40 h-40 bg-cyan-500/20 rounded-full blur-2xl animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Título com animação */}
        <h1
          className={`text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent transition-all duration-700 delay-100 ${
            isAnimating ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          Bags Shield
        </h1>

        <p
          className={`text-lg text-muted-foreground transition-all duration-700 delay-200 ${
            isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Security Gateway for Solana
        </p>

        {/* Loading indicator */}
        {isAnimating && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
