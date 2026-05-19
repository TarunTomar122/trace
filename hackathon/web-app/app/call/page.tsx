'use client';

import { useState, Suspense, useEffect } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

function useSearchParams() {
  const [params, setParams] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const obj: Record<string, string> = {};
    p.forEach((v, k) => { obj[k] = v; });
    setParams(obj);
  }, []);
  return params;
}

export default function CallPage() {
  const search = useSearchParams();
  const avatarId = search?.avatarId || '';
  const name = search?.name || 'Character';
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (search === null) return;

    if (!avatarId) {
      setError('No avatar ID provided');
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);
    fetch('/api/avatar/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.sessionId) setSession(data);
        else setError(data.error || 'Failed to connect');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [avatarId]);

  if (loading) return <div className="call-loading"><div className="call-spinner" /><p>Connecting to {name}...</p></div>;
  if (error) return <div className="call-error"><p>{error}</p></div>;
  if (!session) return null;

  return (
    <div className="call-container">
      <div className="call-header">
        <div className="call-avatar-icon">{name[0]?.toUpperCase()}</div>
        <div className="call-info">
          <h2>{name}</h2>
          <p>Live conversation</p>
        </div>
      </div>
      <AvatarCall avatarId={avatarId} sessionId={session.sessionId} sessionKey={session.sessionKey} onEnd={() => {}} onError={console.error} />
    </div>
  );
}
