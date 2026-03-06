"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';

type Story = {
  id?: string;
  tag: string;
  headline: string;
  caption: string;
  imageUrl: string;
  sourceName?: string;
  sourceUrl?: string;
  section?: string;
  feedDate?: string;
};

type PublishResult = {
  creationId: string;
  mediaId: string;
  imageUrl: string;
};

type ImageCandidate = {
  url: string;
  title: string;
  source: 'wikipedia' | 'commons';
};

type PostFormat = 'square' | 'portrait' | 'story';

const FEED_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'news', label: 'News' },
  { value: 'for_you', label: 'For You' },
] as const;

const FORMAT_OPTIONS: Array<{ value: PostFormat; label: string; ratioClass: string }> = [
  { value: 'square', label: 'Square (1:1)', ratioClass: 'aspect-square' },
  { value: 'portrait', label: 'Portrait (4:5)', ratioClass: 'aspect-[4/5]' },
  { value: 'story', label: 'Story (9:16)', ratioClass: 'aspect-[9/16]' },
];
const STUDIO_KEY_STORAGE_KEY = 'trace_instagram_studio_key';

export default function InstagramStudioPage() {
  const [uid, setUid] = useState('TTK4PNFSO2PxTBrSCvvXBmHsCIE2');
  const [scope, setScope] = useState<'global' | 'user'>('global');
  const [interestOptions, setInterestOptions] = useState<string[]>(['all']);
  const [selectedInterest, setSelectedInterest] = useState('all');
  const [selectedFeedType, setSelectedFeedType] = useState<(typeof FEED_TYPES)[number]['value']>('news');
  const [story, setStory] = useState<Story | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageQuery, setImageQuery] = useState('');
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<PostFormat>('square');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [success, setSuccess] = useState<PublishResult | null>(null);
  const [studioKeyInput, setStudioKeyInput] = useState('');
  const [studioKey, setStudioKey] = useState('');

  const canPublishDirectly = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(STUDIO_KEY_STORAGE_KEY) || '';
    if (saved) {
      setStudioKey(saved);
      setStudioKeyInput(saved);
    }
  }, []);

  const withStudioAuth = useCallback((init?: RequestInit): RequestInit => {
    const headers = new Headers(init?.headers || {});
    if (studioKey) headers.set('x-studio-key', studioKey);
    return { ...init, headers };
  }, [studioKey]);

  useEffect(() => {
    const run = async () => {
      if (!studioKey) return;
      if (scope === 'user' && !uid.trim()) return;
      try {
        const params = new URLSearchParams({ scope });
        if (uid.trim()) params.set('uid', uid.trim());
        const res = await fetch(`/api/dev/instagram/studio/options?${params.toString()}`, withStudioAuth({ cache: 'no-store' }));
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setError('Invalid studio access key.');
          }
          return;
        }
        const values = ['all', ...(Array.isArray(data.interests) ? data.interests : [])];
        setInterestOptions(values);
        setSelectedInterest((prev) => (values.includes(prev) ? prev : 'all'));
      } catch {
        // Ignore options fetch errors; generation still works with "all".
      }
    };
    run();
  }, [uid, scope, studioKey, withStudioAuth]);

  const previewUrls = useMemo<Record<PostFormat, string> | null>(() => {
    if (!story) return null;
    const seed = String(Date.now());
    return FORMAT_OPTIONS.reduce(
      (acc, option) => {
        const params = new URLSearchParams({
          headline: story.headline,
          tag: story.tag,
          imageUrl: story.imageUrl,
          format: option.value,
          t: seed,
        });
        if (studioKey) params.set('key', studioKey);
        acc[option.value] = `/api/dev/instagram/studio/render?${params.toString()}`;
        return acc;
      },
      {} as Record<PostFormat, string>
    );
  }, [story, studioKey]);

  const generateRandom = async () => {
    if (!studioKey) {
      setError('Enter studio access key first.');
      return;
    }
    setError('');
    setSuccess(null);
    setLoadingGenerate(true);
    try {
      const params = new URLSearchParams({ scope });
      if (uid.trim()) params.set('uid', uid);
      params.set('interest', selectedInterest);
      params.set('feedType', selectedFeedType);
      const res = await fetch(`/api/dev/instagram/studio/random?${params.toString()}`, withStudioAuth({ cache: 'no-store' }));
      const data = await res.json();
      if (res.status === 401) throw new Error('Invalid studio access key');
      if (!res.ok) throw new Error(data?.error || 'Failed to generate story');
      setStory(data.story);
      setImageQuery(data.story?.headline || '');
      setImageCandidates([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate story');
    } finally {
      setLoadingGenerate(false);
    }
  };

  const loadStories = async () => {
    if (!studioKey) return;
    setLoadingStories(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (uid.trim()) params.set('uid', uid);
      params.set('interest', selectedInterest);
      params.set('feedType', selectedFeedType);
      params.set('limit', '30');
      const res = await fetch(`/api/dev/instagram/studio/list?${params.toString()}`, withStudioAuth({ cache: 'no-store' }));
      const data = await res.json();
      if (res.status === 401) throw new Error('Invalid studio access key');
      if (!res.ok) throw new Error(data?.error || 'Failed to load stories');
      const list = Array.isArray(data.stories) ? (data.stories as Story[]) : [];
      setStories(list);
      if (list.length > 0) {
        setStory((prev) => {
          if (prev?.id) {
            const matched = list.find((s) => s.id === prev.id);
            if (matched) return matched;
          }
          return list[0];
        });
        setImageQuery(list[0].headline || '');
      } else {
        setStory(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stories');
    } finally {
      setLoadingStories(false);
    }
  };

  useEffect(() => {
    if (!studioKey) return;
    loadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, uid, selectedInterest, selectedFeedType, studioKey]);

  const copyCaption = async () => {
    if (!story) return;
    setActionMessage('');
    try {
      await navigator.clipboard.writeText(story.caption || story.headline);
      setActionMessage('Caption copied.');
    } catch {
      setActionMessage('Could not copy caption.');
    }
  };

  const shareStory = async () => {
    if (!story) return;
    setActionMessage('');
    const url = story.sourceUrl || 'https://www.yourtrace.online/trending';
    const text = (story.caption || story.headline).trim();
    try {
      if (navigator.share) {
        await navigator.share({
          title: story.headline,
          text,
          url,
        });
        setActionMessage('Share sheet opened. Pick Instagram.');
        return;
      }
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setActionMessage('Sharing unavailable here. Copied caption + link instead.');
    } catch {
      setActionMessage('Share canceled.');
    }
  };

  const searchRelatedImages = async () => {
    if (!studioKey) {
      setError('Enter studio access key first.');
      return;
    }
    const query = (imageQuery || story?.headline || '').trim();
    if (!query) return;
    setLoadingImages(true);
    setError('');
    try {
      const params = new URLSearchParams({ query });
      const res = await fetch(`/api/dev/instagram/studio/image-search?${params.toString()}`, withStudioAuth({ cache: 'no-store' }));
      const data = await res.json();
      if (res.status === 401) throw new Error('Invalid studio access key');
      if (!res.ok) throw new Error(data?.error || 'Failed to search images');
      setImageCandidates(Array.isArray(data.images) ? data.images : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search images');
    } finally {
      setLoadingImages(false);
    }
  };

  const publishToInstagram = async () => {
    if (!studioKey) {
      setError('Enter studio access key first.');
      return;
    }
    if (!story) return;
    setError('');
    setSuccess(null);
    setLoadingPublish(true);
    try {
      const res = await fetch('/api/dev/instagram/studio/publish', withStudioAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: story.tag,
          headline: story.headline,
          caption: story.caption,
          imageUrl: story.imageUrl,
          format: selectedFormat,
        }),
      }));
      const data = await res.json();
      if (res.status === 401) throw new Error('Invalid studio access key');
      if (!res.ok) throw new Error(data?.error || 'Failed to publish');
      setSuccess(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setLoadingPublish(false);
    }
  };

  const unlockStudio = () => {
    const key = studioKeyInput.trim();
    if (!key) {
      setError('Enter a studio access key.');
      return;
    }
    setError('');
    setStudioKey(key);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STUDIO_KEY_STORAGE_KEY, key);
    }
  };

  const clearStudioKey = () => {
    setStudioKey('');
    setStudioKeyInput('');
    setStories([]);
    setStory(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STUDIO_KEY_STORAGE_KEY);
    }
  };

  if (!studioKey) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8">
        <div className="max-w-xl mx-auto mt-20 border border-slate-200 rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Instagram Studio</h1>
          <p className="text-sm text-slate-600 mt-2">
            Enter studio access key to unlock.
          </p>
          <input
            type="password"
            value={studioKeyInput}
            onChange={(e) => setStudioKeyInput(e.target.value)}
            className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm mt-4"
            placeholder="Studio access key"
          />
          <button
            onClick={unlockStudio}
            className="mt-3 w-full rounded-lg bg-slate-900 text-white px-4 py-2 font-semibold"
          >
            Unlock Studio
          </button>
          {error ? <p className="text-red-600 text-sm mt-3">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold">Instagram Studio</h1>
        <p className="text-slate-600 mt-2">Generate, edit, preview, share, and copy one post.</p>
        <div className="mt-3">
          <button
            onClick={clearStudioKey}
            className="text-xs rounded-md border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
          >
            Lock Studio
          </button>
        </div>

        <div className="grid xl:grid-cols-[320px_minmax(480px,1fr)_360px] gap-6 mt-6 items-start">
          <section className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Generation</h2>
            <label className="block text-sm text-slate-700 mb-2">Source Pool</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScope('global')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  scope === 'global' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Global Today
              </button>
              <button
                onClick={() => setScope('user')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  scope === 'user' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Specific User
              </button>
            </div>

            <label className="block text-sm text-slate-700 mb-2">User ID</label>
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              disabled={scope !== 'user'}
              placeholder={scope === 'user' ? 'Enter user id' : 'Not needed in Global Today mode'}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
            />

            <label className="block text-sm text-slate-700 mt-4 mb-2">Interest Tag</label>
            <select
              value={selectedInterest}
              onChange={(e) => setSelectedInterest(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
            >
              {interestOptions.map((interest) => (
                <option key={interest} value={interest}>
                  {interest === 'all' ? 'All interests' : interest}
                </option>
              ))}
            </select>

            <label className="block text-sm text-slate-700 mt-4 mb-2">Feed Type</label>
            <select
              value={selectedFeedType}
              onChange={(e) => setSelectedFeedType(e.target.value as (typeof FEED_TYPES)[number]['value'])}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
            >
              {FEED_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <button
              onClick={generateRandom}
              disabled={loadingGenerate || (scope === 'user' && !uid.trim())}
              className="mt-4 w-full rounded-lg bg-slate-900 text-white px-4 py-2 font-semibold disabled:opacity-50"
            >
              {loadingGenerate ? 'Generating...' : 'Generate Random Story'}
            </button>
            <button
              onClick={loadStories}
              disabled={loadingStories || (scope === 'user' && !uid.trim())}
              className="mt-2 w-full rounded-lg bg-slate-200 text-slate-900 px-4 py-2 font-semibold disabled:opacity-50"
            >
              {loadingStories ? 'Loading Stories...' : 'Load Trending Stories'}
            </button>

            <p className="text-xs text-slate-500 mt-3">Load all matching stories, then pick one to share/copy.</p>

            {stories.length > 0 ? (
              <div className="mt-4 border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {stories.map((entry, idx) => {
                  const selected = (story?.id && story.id === entry.id) || (!story?.id && idx === 0);
                  return (
                    <button
                      key={entry.id || `${entry.headline}-${idx}`}
                      onClick={() => {
                        setStory(entry);
                        setImageQuery(entry.headline || '');
                        setActionMessage('');
                      }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${
                        selected ? 'bg-slate-100' : ''
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{entry.tag}</div>
                      <div className="text-sm font-medium text-slate-900 line-clamp-2 mt-1">{entry.headline}</div>
                      {entry.sourceName ? (
                        <div className="text-xs text-slate-500 mt-1">{entry.sourceName}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {error ? <p className="text-red-600 text-sm mt-4">{error}</p> : null}
            {success ? (
              <div className="text-emerald-700 text-sm mt-4 space-y-1">
                <p>Posted successfully.</p>
                <p>Creation ID: {success.creationId}</p>
                <p>Media ID: {success.mediaId}</p>
              </div>
            ) : null}
          </section>

          <section className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm xl:sticky xl:top-6">
            <h2 className="text-sm text-slate-600 mb-3">Post Previews (All Sizes)</h2>
            {story && previewUrls ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {FORMAT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFormat(option.value)}
                      className={`text-xs font-medium rounded-md border px-2 py-1 ${
                        selectedFormat === option.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div
                    className={`w-full overflow-hidden rounded-md border border-slate-200 ${
                      FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.ratioClass || 'aspect-square'
                    }`}
                  >
                    <img
                      src={previewUrls[selectedFormat]}
                      alt={`${FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label || 'Selected'} preview`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm text-slate-600 mt-2">
                    {FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label || 'Square (1:1)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square rounded-xl border border-slate-200 bg-slate-100 grid place-items-center text-slate-500">
                Generate a story to preview
              </div>
            )}
          </section>

          <section className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Edit, Share & Copy</h2>
            {story ? (
              <>
                <label className="block text-sm text-slate-700 mb-2">Tag</label>
                <input
                  value={story.tag}
                  onChange={(e) => setStory({ ...story, tag: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-sm text-slate-700 mt-4 mb-2">Headline</label>
                <textarea
                  value={story.headline}
                  onChange={(e) => setStory({ ...story, headline: e.target.value })}
                  className="w-full min-h-[90px] rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-sm text-slate-700 mt-4 mb-2">Caption</label>
                <textarea
                  value={story.caption}
                  onChange={(e) => setStory({ ...story, caption: e.target.value })}
                  className="w-full min-h-[220px] rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-sm text-slate-700 mt-4 mb-2">Background Image URL</label>
                <input
                  value={story.imageUrl}
                  onChange={(e) => setStory({ ...story, imageUrl: e.target.value })}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
                />

                <label className="block text-sm text-slate-700 mt-4 mb-2">Find Related Images</label>
                <div className="flex gap-2">
                  <input
                    value={imageQuery}
                    onChange={(e) => setImageQuery(e.target.value)}
                    placeholder="Anthropic AI, NVIDIA chip, etc."
                    className="flex-1 rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={searchRelatedImages}
                    disabled={loadingImages}
                    className="rounded-lg bg-slate-200 text-slate-900 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {loadingImages ? 'Searching...' : 'Search'}
                  </button>
                </div>
                {imageCandidates.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {imageCandidates.map((img) => (
                      <button
                        key={img.url}
                        onClick={() => setStory({ ...story, imageUrl: img.url })}
                        className="border border-slate-200 rounded-md overflow-hidden bg-white text-left"
                        title={`${img.title} (${img.source})`}
                      >
                        <img src={img.url} alt={img.title} className="w-full h-20 object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 text-xs text-slate-600">
                  Selected post format:{' '}
                  <span className="font-semibold">
                    {FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label || 'Square (1:1)'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={shareStory}
                    className="rounded-lg bg-blue-600 text-white px-4 py-2 font-semibold"
                  >
                    Share to Instagram
                  </button>
                  <button
                    onClick={copyCaption}
                    className="rounded-lg bg-slate-200 text-slate-900 px-4 py-2 font-semibold"
                  >
                    Copy Caption
                  </button>
                </div>
                {actionMessage ? (
                  <p className="text-xs text-slate-600 mt-2">{actionMessage}</p>
                ) : null}

                {canPublishDirectly ? (
                  <button
                    onClick={publishToInstagram}
                    disabled={loadingPublish}
                    className="mt-4 w-full rounded-lg bg-emerald-500 text-white px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    {loadingPublish ? 'Uploading...' : 'Upload to Instagram'}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 mt-4">
                    Direct token publish is disabled in production. Use Share + Copy Caption.
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-500">Generate a story to unlock editing and publish controls.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
