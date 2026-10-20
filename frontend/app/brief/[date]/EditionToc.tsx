'use client';

import { useEffect, useRef, useState } from 'react';

export type TocGroup = { label: string; items: { n: number; title: string }[] };

/**
 * Which story is in view: the highest one crossing a band just under the
 * sticky header. Stories are `#story-N` list items (see the edition page).
 */
function useActiveStory(groups: TocGroup[]): number {
  const [active, setActive] = useState(1);
  useEffect(() => {
    const stories = groups
      .flatMap((group) => group.items)
      .map((item) => document.getElementById(`story-${item.n}`))
      .filter((el): el is HTMLElement => el !== null);
    if (!stories.length || typeof IntersectionObserver === 'undefined') return;
    const crossing = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number((entry.target as HTMLElement).dataset.story);
          if (entry.isIntersecting) crossing.add(n);
          else crossing.delete(n);
        }
        if (crossing.size) setActive(Math.min(...crossing));
        // Back above the first story (e.g. a jump to the top): nothing crosses the band.
        else if (stories[0].getBoundingClientRect().top > 96) setActive(Number(stories[0].dataset.story));
      },
      // From just below where a jumped-to story lands (header + scroll padding,
      // 84px) down to 40% of the screen, so the story above it no longer counts.
      { rootMargin: '-96px 0px -60% 0px' },
    );
    stories.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [groups]);
  return active;
}

/** Desktop: the sticky "In this edition" column, highlighting the story in view. */
export default function EditionToc({ groups }: { groups: TocGroup[] }) {
  const active = useActiveStory(groups);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the highlighted item visible when the list itself scrolls (15-story editions).
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !current || list.scrollHeight <= list.clientHeight) return;
    const top = current.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + current.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - list.clientHeight / 3);
    }
  }, [active]);

  return (
    <nav className="br-toc" aria-labelledby="toc-title">
      <p className="br-toc-title" id="toc-title">In this edition</p>
      <ol className="br-toc-list" ref={listRef}>
        {groups.map((group) => (
          <li key={group.items[0]?.n ?? group.label} className="br-toc-group">
            <p className="br-toc-label">{group.label}</p>
            <ol>
              {group.items.map((item) => (
                <li key={item.n}>
                  <a href={`#story-${item.n}`} className="br-toc-link" aria-current={active === item.n ? 'true' : undefined}>
                    <span className="br-toc-n">{item.n}</span>
                    <span className="br-toc-t">{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Phones and tablets: the same list as a "Jump to a story" dropdown that closes on pick. */
export function EditionJump({ groups }: { groups: TocGroup[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="br-jump" ref={ref}>
      <summary>Jump to a story</summary>
      <ol>
        {groups.map((group) => (
          <li key={group.items[0]?.n ?? group.label}>
            <p className="br-jump-label">{group.label}</p>
            <ol>
              {group.items.map((item) => (
                <li key={item.n}>
                  <a href={`#story-${item.n}`} onClick={() => { if (ref.current) ref.current.open = false; }}>
                    <span className="br-toc-n">{item.n}</span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </details>
  );
}
