import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);

export async function GET(request: Request, { params }: { params: { mint: string } }) {
  const mintAddress = params.mint;

  try {
    try {
      new PublicKey(mintAddress);
    } catch {
      return NextResponse.json({ error: "Invalid Mint Address" }, { status: 400 });
    }

    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
    
    if (!mintInfo.value) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const data = mintInfo.value.data;
    let mintAuthority = false;
    let freezeAuthority = false;
    
    if ('parsed' in data) {
      const info = data.parsed.info;
      mintAuthority = info.mintAuthority !== null;
      freezeAuthority = info.freezeAuthority !== null;
    }

    let score = 100;
    if (mintAuthority) score -= 40; 
    if (freezeAuthority) score -= 30;
    
    const realData = {
      tokenInfo: {
        name: \Token \...\,
        symbol: "UNKNOWN",
        image: "", 
        mint: mintAddress
      },
      security: {
        score: score,
        isSafe: score > 50,
        mintAuthority: mintAuthority,
        lpLocked: false, 
        freezeAuthority: freezeAuthority
      },
      integrity: {
        isVerified: false 
      }
    };

    return NextResponse.json({ success: true, response: realData });

  } catch (error: any) {
    console.error("Scan Error:", error);
    return NextResponse.json({ error: "Scan Failed" }, { status: 500 });
  }
}
