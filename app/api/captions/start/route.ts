import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    if (!roomName) {
      return new NextResponse('Missing roomName', { status: 400 });
    }

    const agentId = process.env.CAPTIONS_AGENT_ID;
    const cloudApiKey = process.env.LIVEKIT_CLOUD_API_KEY;
    const cloudApiSecret = process.env.LIVEKIT_CLOUD_API_SECRET;
    const cloudApiBase = process.env.LIVEKIT_CLOUD_API_BASE || 'https://cloud.livekit.io';

    if (!agentId || !cloudApiKey || !cloudApiSecret) {
      return new NextResponse('Captions agent not configured', { status: 500 });
    }

    // Create agent job via LiveKit Cloud control plane
    const url = new URL(`/v1/agents/${agentId}/jobs`, cloudApiBase);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudApiKey}:${cloudApiSecret}`,
      },
      body: JSON.stringify({ 
        room: roomName,
        // Optional: add target language for translation
        // target_language: req.nextUrl.searchParams.get('target') || 'en'
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Failed to start captions agent:', text);
      return new NextResponse(text || 'Failed to start captions', { status: 502 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    console.error('Captions start error:', e);
    return new NextResponse(e?.message ?? 'Internal error', { status: 500 });
  }
}


