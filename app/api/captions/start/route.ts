import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    const targetLanguage = req.nextUrl.searchParams.get('target') || 'en';
    const sttLanguage = req.nextUrl.searchParams.get('stt') || undefined;
    
    if (!roomName) {
      return new NextResponse('Missing roomName', { status: 400 });
    }

    const agentUrl = process.env.CAPTIONS_AGENT_URL;
    if (!agentUrl) {
      return new NextResponse('Captions agent URL not configured', { status: 500 });
    }

    // Call the Railway-deployed agent
    const res = await fetch(`${agentUrl}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        roomName,
        targetLanguage,
        sttLanguage
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Failed to start captions agent:', text);
      return new NextResponse(text || 'Failed to start captions', { status: 502 });
    }

    const result = await res.json();
    return new NextResponse(JSON.stringify(result), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Captions start error:', e);
    return new NextResponse(e?.message ?? 'Internal error', { status: 500 });
  }
}


