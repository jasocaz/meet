# Txat

**Real-time translation meetings powered by LiveKit**

<p>
  <a href="https://docs.livekit.io/">LiveKit Docs</a>
  •
  <a href="https://livekit.io/cloud">LiveKit Cloud</a>
  •
  <a href="https://blog.livekit.io/">Blog</a>
</p>

<br>

Txat is a real-time translation video conferencing app built on [LiveKit Components](https://github.com/livekit/components-js), [LiveKit Cloud](https://cloud.livekit.io/), and Next.js. It provides automatic transcription and translation during video meetings, enabling seamless communication across language barriers.

## Features

- 🎥 **Video Conferencing** - High-quality video meetings powered by LiveKit
- 🗣️ **Real-time Transcription** - Automatic speech-to-text for all participants  
- 🌍 **Live Translation** - Instant translation between multiple languages
- 👥 **Multi-participant Support** - Per-participant language preferences
- 🔒 **End-to-End Encryption** - Secure meetings with E2EE support

## Tech Stack

- This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).
- App is built with [@livekit/components-react](https://github.com/livekit/components-js/) library.
- Translation powered by OpenAI GPT-4o and Whisper
- Deployed on Vercel (dev) and Railway (production)

## Dev Setup

Steps to get a local dev setup up and running:

1. Run `pnpm install` to install all dependencies.
2. Copy `.env.example` in the project root and rename it to `.env.local`.
3. Update the missing environment variables in the newly created `.env.local` file.
4. Set up the captions agent (see `agent-starter-node/` directory)
5. Run `pnpm dev` to start the development server and visit [http://localhost:3000](http://localhost:3000) to see the result.
6. Start development 🎉

## Environment Variables

Required environment variables:

- `LIVEKIT_URL` - Your LiveKit server URL
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret  
- `CAPTIONS_AGENT_URL` - URL of your deployed captions agent

## Captions Agent

The transcription and translation functionality requires a separate Node.js agent. See the `agent-starter-node/` directory for setup instructions.