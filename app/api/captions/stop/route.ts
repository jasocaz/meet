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

    // List active jobs for this agent and room, then stop them
    const listUrl = new URL(`/v1/agents/${agentId}/jobs`, cloudApiBase);
    const listRes = await fetch(listUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cloudApiKey}:${cloudApiSecret}`,
      },
      cache: 'no-store',
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      console.error('Failed to list agent jobs:', text);
      return new NextResponse(text || 'Failed to list agent jobs', { status: 502 });
    }

    const jobs = await listRes.json();
    const activeJobs = jobs.jobs?.filter((job: any) => 
      job.room === roomName && (job.status === 'running' || job.status === 'starting')
    ) || [];

    // Stop all active jobs for this room
    const stopPromises = activeJobs.map(async (job: any) => {
      const stopUrl = new URL(`/v1/agents/${agentId}/jobs/${job.id}`, cloudApiBase);
      return fetch(stopUrl.toString(), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${cloudApiKey}:${cloudApiSecret}`,
        },
      });
    });

    await Promise.all(stopPromises);

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    console.error('Captions stop error:', e);
    return new NextResponse(e?.message ?? 'Internal error', { status: 500 });
  }
}


