import Link from 'next/link';
import { ExternalLink, LineChart, Smartphone } from 'lucide-react';

export default function Footer(_props: { variant?: 'default' | 'landing' } = {}) {
  return (
    <footer className="bg-[#faf9f5] px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 border-t border-[#e4e1d8] pt-8">
        <span className="font-mono text-[11px] font-semibold tracking-[0.24em] text-[#1b1a17]">TRACE</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#75705f]">
          <Link href="/feed" className="hover:text-[#2557d6]">Edition</Link>
          <Link href="/feed?view=pulse" className="hover:text-[#2557d6]">Pulse</Link>
          <Link href="/compare" className="hover:text-[#2557d6]">Compare</Link>
          <Link href="/blog" className="hover:text-[#2557d6]">Guides</Link>
          <Link href="/how-it-works" className="hover:text-[#2557d6]">How it works</Link>
          <Link href="/privacy-policy" className="hover:text-[#2557d6]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#2557d6]">Terms</Link>
          <Link href="/contact" className="hover:text-[#2557d6]">Contact</Link>
        </nav>
      </div>
      <div className="mx-auto mt-6 max-w-[1180px] border-t border-[#e4e1d8] pt-5">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#75705f]">More from the founder</p>
        <div className="mt-3 grid gap-3">
          <a href="https://stocksbrew.online/?utm_source=trace&utm_medium=footer" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70"><LineChart size={15} strokeWidth={1.8} /><span>StocksBrew</span><span className="text-[#75705f]">Know what to do with your stock</span><ExternalLink size={12} strokeWidth={1.8} /></a>
          <a href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app" className="inline-flex w-fit items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70"><Smartphone size={15} strokeWidth={1.8} /><span>Trace for Android</span><ExternalLink size={12} strokeWidth={1.8} /></a>
        </div>
      </div>
    </footer>
  );
}
