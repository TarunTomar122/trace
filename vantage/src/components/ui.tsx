import { useEffect, useRef, useState, type ReactNode } from 'react';

// Scroll-in reveal — makes sections feel deliberate without a motion library.
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: 'opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)',
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(18px)',
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  label,
  title,
  sub,
  center = false,
}: {
  label?: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {label && <span className="pill mb-3">{label}</span>}
      <h2 className="h-display text-[1.9rem] leading-[1.08] sm:text-[2.6rem]">{title}</h2>
      {sub && <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">{sub}</p>}
    </div>
  );
}
