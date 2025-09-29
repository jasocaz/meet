import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    if (!roomName) {
      return new NextResponse('Missing roomName', { status: 400 });
    }

    const agentUrl = process.env.CAPTIONS_AGENT_URL;
    const agentSecret = process.env.CAPTIONS_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return new NextResponse('Captions agent not configured', { status: 500 });
    }

    const url = new URL('/start', agentUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentSecret}`,
      },
      body: JSON.stringify({ roomName }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text || 'Failed to start captions', { status: 502 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return new NextResponse(e?.message ?? 'Internal error', { status: 500 });
  }
}


