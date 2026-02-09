"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, LogOut, Sun, Moon, Lightbulb } from "lucide-react";
import { useTheme } from "next-themes";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/contexts/AuthContext";

type MainNavProps = {
  showBanner?: boolean;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function MainNav({ showBanner = false }: MainNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setMounted(true), []);

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 z-50 transition-all duration-500",
        showBanner ? "top-[40px]" : "top-0"
      )}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "bg-background/95 backdrop-blur-md w-full transition-all duration-500 rounded-2xl mt-4",
            scrolled
              ? "border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none px-4 py-3"
              : "border-transparent px-4 py-5"
          )}
        >
          <div className="flex items-center justify-between w-full">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Desktop Left Nav */}
            <div className="hidden md:flex items-center gap-1 flex-1">
              {!user && (
                <a
                  href="#how"
                  className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  How It Works
                </a>
              )}
              {user && (
                <a
                  href="/feed"
                  className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Your Feed
                </a>
              )}
              <a
                href="/trending"
                className="px-4 py-2 text-sm font-medium text-secondary hover:text-foreground transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Trending
              </a>
            </div>

            {/* Logo - Centered */}
            <div className="text-lg md:text-xl text-foreground uppercase flex items-center gap-2 tracking-wide font-semibold md:absolute md:left-1/2 md:-translate-x-1/2">
              <Lightbulb size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={1.5} />
              TRACE
            </div>

            {/* Desktop Right Nav */}
            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium text-secondary">
                      {profile?.name?.split(" ")[0] ||
                        user.displayName?.split(" ")[0]}
                    </span>
                  </Link>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-foreground text-background px-6 py-2.5 rounded-full text-sm font-medium hover:bg-foreground/90 transition-all"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile CTA */}
            <div className="md:hidden flex items-center gap-2">
              {/* Mobile Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-secondary hover:text-foreground"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              {user ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                </Link>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 flex flex-col gap-1 border-t border-gray-200 dark:border-gray-800 mt-4">
                  {!user && (
                    <a
                      href="#how"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      How It Works
                    </a>
                  )}
                  {user && (
                    <a
                      href="/feed"
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Your Feed
                    </a>
                  )}
                  <a
                    href="/trending"
                    className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Trending
                  </a>
                  {user ? (
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        signInWithGoogle();
                        setMobileMenuOpen(false);
                      }}
                      className="px-3 py-2.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                    >
                      Sign In with Google
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </nav>
  );
}
