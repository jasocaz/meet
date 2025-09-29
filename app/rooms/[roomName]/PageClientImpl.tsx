'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
  useParticipants,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  Track,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const lowPowerMode = useLowCPUOptimizer(room);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  const chatFormatter = React.useCallback(
    (message: string) => {
      const base = formatChatMessageLinks(message);
      const isTranscript = message.startsWith('[Transcript]');
      const isTranslation = message.startsWith('[Translation]');
      if (!isTranscript && !isTranslation) return base;
      const label = isTranscript ? 'Transcript' : 'Translation';
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid var(--lk-border-color, #2a2a2a)',
              opacity: 0.8,
            }}
          >
            {label}
          </span>
          {base}
        </span>
      );
    },
    []
  );

  return (
    <div className="lk-room-container" style={{ position: 'relative' }}>
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <CaptionsChatBridge room={room} />
        <VideoConference
          chatMessageFormatter={chatFormatter}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <TranscribingPillInControlBar />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}

function CaptionsChatBridge(props: { room: Room }) {
  const { room } = props;
  React.useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: any,
      _kind?: any,
      topic?: string,
    ) => {
      // Bridge only captions topic messages
      if (topic !== 'captions') return;
      try {
        const json = JSON.parse(new TextDecoder().decode(payload));
        if (json?.type === 'transcription') {
          const text = `[Transcript] ${json.speaker ?? 'Speaker'}: ${json.text ?? ''}`;
          room.localParticipant.sendChatMessage(text).catch(() => void 0);
        } else if (json?.type === 'translation') {
          const text = `[Translation] ${json.speaker ?? 'Speaker'}: ${json.translatedText ?? ''}`;
          room.localParticipant.sendChatMessage(text).catch(() => void 0);
        }
      } catch {
        // ignore non-JSON
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);
  return null;
}

function isAgentParticipant(p: any): boolean {
  try {
    if (typeof p?.metadata === 'string' && p.metadata) {
      const meta = JSON.parse(p.metadata);
      if (meta?.role === 'agent' || meta?.subtype === 'captions') return true;
    }
  } catch {}
  const name: string | undefined = (p as any)?.name;
  const identity: string | undefined = (p as any)?.identity;
  return Boolean(
    (!!name && name.toLowerCase().includes('captions')) ||
      (!!identity && identity.startsWith('captions-agent'))
  );
}

function TranscribingPillInControlBar() {
  const participants = useParticipants();
  const agentPresent = participants.some((p) => isAgentParticipant(p));
  const container = React.useMemo(() => {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.lk-control-bar');
  }, []);
  const pill = (
    <div
      aria-label="Transcribing"
      style={{
        fontSize: 14,
        padding: '8px 14px',
        borderRadius: 8,
        userSelect: 'none',
        order: -1,
        marginRight: 12,
        border: agentPresent ? '2px solid #e5484d' : '1px solid rgba(255,255,255,0.2)',
        color: agentPresent ? '#e5484d' : 'rgba(255,255,255,0.8)',
        background: agentPresent ? 'rgba(229,72,77,0.08)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {agentPresent ? 'Transcribing' : 'Transcribing (off)'}
    </div>
  );
  if (container) return createPortal(pill, container);
  return null;
}
