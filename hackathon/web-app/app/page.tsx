'use client';

import { useMemo, useState, Suspense } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

function callStep(body: any) {
  return fetch('/api/steps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
}
function extractVideoId(url: string) { const m = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/); return m ? m[1] : null; }

type RunStatus = 'idle' | 'running' | 'done' | 'error';
type AppStage = 'pipeline' | 'chat';

interface PipelineStepState {
  key: string;
  label: string;
  status: RunStatus;
}

export default function Home() {
  const DEMO_VIDEO_ID = 'f4Lj8nucm-A';
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [error, setError] = useState('');
  const [stage, setStage] = useState<AppStage>('pipeline');
  const [avatarId, setAvatarId] = useState('');
  const [avatarName, setAvatarName] = useState('Speaker');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [chatSession, setChatSession] = useState<any>(null);
  const [speakers, setSpeakers] = useState<any[]>([]);
  const [frameList, setFrameList] = useState<any[]>([]);
  const [steps, setSteps] = useState<PipelineStepState[]>([
    { key: 'transcript', label: 'Extract transcript', status: 'idle' },
    { key: 'frames', label: 'Extract faces', status: 'idle' },
    { key: 'analyze', label: 'Analyze speaker', status: 'idle' },
    { key: 'voice', label: 'Extract voice clip', status: 'idle' },
    { key: 'clone', label: 'Clone voice', status: 'idle' },
    { key: 'avatar', label: 'Create avatar', status: 'idle' },
  ]);

  const completedCount = useMemo(() => steps.filter((s) => s.status === 'done').length, [steps]);
  const progress = Math.round((completedCount / steps.length) * 100);

  const markStep = (key: string, status: RunStatus) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  };

  const detectVideoTitle = async (videoUrl: string) => {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.title) setVideoTitle(data.title);
    } catch {
      // Non-critical metadata fetch.
    }
  };

  const startChat = async (nextAvatarId: string, nextAvatarName: string) => {
    setSessionLoading(true);
    setSessionError('');
    try {
      const res = await fetch('/api/avatar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: nextAvatarId }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data?.error || 'Failed to connect');
      setAvatarId(nextAvatarId);
      setAvatarName(nextAvatarName || 'Speaker');
      setChatSession(data);
      setStage('chat');
    } catch (e: any) {
      setSessionError(e?.message || 'Failed to start chat');
    } finally {
      setSessionLoading(false);
    }
  };

  const runAllSteps = async () => {
    const vid = extractVideoId(url);
    if (!vid) {
      setError('Enter a valid YouTube URL first.');
      return;
    }

    setRunStatus('running');
    setError('');
    setSessionError('');
    setVideoId(vid);
    setVideoTitle('');
    setSpeakers([]);
    setFrameList([]);
    setChatSession(null);
    setStage('pipeline');
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'idle' })));
    await detectVideoTitle(url);

    try {
      markStep('transcript', 'running');
      const transcript = await callStep({ step: 'transcript', videoId: vid });
      if (!transcript?.ok) throw new Error(transcript?.error || 'Transcript failed');
      markStep('transcript', 'done');
      const transcriptSpeakers = transcript.speakers || [];
      setSpeakers(transcriptSpeakers);
      const selectedSpeaker = transcriptSpeakers[0]?.name || 'Speaker';

      markStep('frames', 'running');
      const frames = await callStep({ step: 'frames', videoId: vid });
      if (!frames?.ok) throw new Error(frames?.error || 'Frame extraction failed');
      markStep('frames', 'done');
      const nextFrames = frames.frames || [];
      setFrameList(nextFrames);

      markStep('analyze', 'running');
      const analyze = await callStep({ step: 'analyze', videoId: vid, speaker: selectedSpeaker });
      if (!analyze?.ok) throw new Error(analyze?.error || 'Speaker analysis failed');
      markStep('analyze', 'done');

      markStep('voice', 'running');
      const voice = await callStep({
        step: 'voice',
        videoId: vid,
        speaker: selectedSpeaker,
        voiceStart: analyze.voice_start,
        voiceEnd: analyze.voice_end,
      });
      if (!voice?.ok) throw new Error(voice?.error || 'Voice clip extraction failed');
      markStep('voice', 'done');

      markStep('clone', 'running');
      const clone = await callStep({ step: 'clone', videoId: vid });
      if (!clone?.ok || !clone.voice_id) throw new Error(clone?.error || 'Voice clone failed');
      markStep('clone', 'done');

      markStep('avatar', 'running');
      const avatar = await callStep({
        step: 'avatar',
        videoId: vid,
        speaker: selectedSpeaker,
        voiceId: clone.voice_id,
        frameIndex: 0,
      });
      if (!avatar?.ok || !avatar.avatar_id) throw new Error(avatar?.error || 'Avatar creation failed');
      markStep('avatar', 'done');

      setRunStatus('done');
      await startChat(avatar.avatar_id, avatar.name || selectedSpeaker || 'Speaker');
    } catch (e: any) {
      setRunStatus('error');
      setError(e?.message || 'Pipeline failed');
      setSteps((prev) => prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)));
    }
  };

  const loadSavedDemoAvatar = async () => {
    setError('');
    setSessionError('');
    setRunStatus('running');
    setVideoId(DEMO_VIDEO_ID);
    setVideoTitle('');
    try {
      const clone = await callStep({ step: 'clone', videoId: DEMO_VIDEO_ID });
      if (!clone?.ok || !clone?.voice_id) {
        throw new Error(clone?.error || 'Clone failed');
      }

      const avatar = await callStep({
        step: 'avatar',
        videoId: DEMO_VIDEO_ID,
        speaker: 'Speaker',
        voiceId: clone.voice_id,
        frameIndex: 0,
      });
      if (!avatar?.ok || !avatar?.avatar_id) {
        throw new Error(avatar?.error || 'Avatar creation failed');
      }

      setRunStatus('done');
      await startChat(avatar.avatar_id, avatar.name || 'Speaker');
    } catch (e: any) {
      setRunStatus('error');
      setError(e?.message || 'Failed to rebuild demo avatar');
    }
  };

  const reset = () => {
    setUrl('');
    setVideoId('');
    setVideoTitle('');
    setRunStatus('idle');
    setError('');
    setSessionError('');
    setSessionLoading(false);
    setAvatarId('');
    setAvatarName('Speaker');
    setSpeakers([]);
    setFrameList([]);
    setChatSession(null);
    setStage('pipeline');
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'idle' })));
  };

  if (stage === 'chat' && chatSession && avatarId) {
    return (
      <main className="chat-screen">
        <header className="chat-screen-header">
          <div>
            <h1>{avatarName}</h1>
            <p>{videoTitle || `YouTube video: ${videoId}`}</p>
          </div>
          <button className="sketch-btn secondary" onClick={reset}>New Chat</button>
        </header>
        <div className="chat-fullstage">
          <Suspense fallback={<div className="chat-loading">Connecting...</div>}>
            <AvatarCall avatarId={avatarId} sessionId={chatSession.sessionId} sessionKey={chatSession.sessionKey} onEnd={() => {}} onError={console.error} />
          </Suspense>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <header className="app-header">
        <h1>YapTrap</h1>
        <span className="header-sub">Paste a YouTube link, run all steps, then jump straight into full-screen chat.</span>
      </header>

      <section className="panel wobbly-card">
        <label className="field-label">YouTube URL</label>
        <div className="input-row">
          <input
            className="sketch-input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={runStatus === 'running' || sessionLoading}
          />
          <button className="sketch-btn" onClick={runAllSteps} disabled={!url || runStatus === 'running' || sessionLoading}>
            {runStatus === 'running' ? 'Running...' : 'Run All Steps'}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="sketch-btn secondary" onClick={loadSavedDemoAvatar} disabled={runStatus === 'running' || sessionLoading}>
            Reclone Jensen Demo Voice
          </button>
        </div>
        {videoTitle && <p className="meta-line">Video: {videoTitle}</p>}
        {!videoTitle && videoId && <p className="meta-line">Video ID: {videoId}</p>}
      </section>

      <section className="panel wobbly-card rotate-left">
        <div className="progress-head">
          <h2>Progress</h2>
          <span>{progress}%</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="steps-list">
          {steps.map((step, idx) => (
            <div key={step.key} className={`step-row ${step.status}`}>
              <span className="step-index">{idx + 1}</span>
              <span className="step-text">{step.label}</span>
              <span className="step-state">
                {step.status === 'done' ? 'done' : step.status === 'running' ? 'running' : step.status === 'error' ? 'failed' : 'waiting'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {(speakers.length > 0 || frameList.length > 0) && (
        <section className="panel wobbly-card rotate-right">
          <h2>Detected Speaker</h2>
          {speakers.length > 0 && <p className="meta-line">{speakers[0]?.name || 'Speaker'}</p>}
          {frameList.length > 0 && (
            <div className="frames-strip">
              {frameList.map((f: any) => (
                <img key={f.index} src={`/api/outputs/${videoId}/frame_${f.index}.jpg`} alt={`Frame ${f.index}`} />
              ))}
            </div>
          )}
        </section>
      )}

      {(error || sessionError) && (
        <section className="panel wobbly-card error-card">
          <h2>Issue</h2>
          <p>{error || sessionError}</p>
        </section>
      )}

      {(runStatus === 'done' || runStatus === 'error') && (
        <div className="footer-actions">
          <button className="sketch-btn secondary" onClick={reset}>Reset</button>
        </div>
      )}

      {sessionLoading && (
        <section className="panel wobbly-card">
          <h2>Preparing Chat</h2>
          <p className="meta-line">Waiting for avatar session to become ready...</p>
        </section>
      )}
    </main>
  );
}
