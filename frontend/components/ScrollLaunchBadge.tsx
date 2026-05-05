/** Server-rendered for ScrollLaunch verification (must appear in initial HTML). */
export default function ScrollLaunchBadge() {
  return (
    <a
      href="https://www.scrolllaunch.com/products/trace?utm_source=badge&utm_medium=embed&utm_campaign=trace&ref=scrolllaunch"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block opacity-90 transition-opacity hover:opacity-100"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external badge asset */}
      <img
        src="https://www.scrolllaunch.com/api/badge/trace"
        alt="Featured on ScrollLaunch"
        width={220}
        height={48}
        loading="lazy"
        className="h-auto max-w-full w-[220px]"
      />
    </a>
  );
}
