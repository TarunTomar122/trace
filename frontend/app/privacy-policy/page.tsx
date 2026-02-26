"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="flex items-center justify-between py-4">
                        <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            <ArrowLeft size={16} />
                            Back to Home
                        </Link>
                        <div className="text-lg text-foreground uppercase flex items-center gap-3 tracking-[0.1em] font-semibold">
                            <img
                                src="/trace.webp"
                                alt="Trace Logo"
                                width={120}
                                height={38}
                                className="h-6 w-auto object-contain"
                            />
                            TRACE
                        </div>
                        <div className="w-24"></div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-32 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                                <Shield className="text-primary" size={24} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground">
                                    Privacy Policy
                                </h1>
                            </div>
                        </div>
                        <p className="text-sm text-secondary mt-2">
                            Last Updated: February 17, 2026
                        </p>
                    </motion.div>

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="prose prose-sm md:prose-base dark:prose-invert max-w-none"
                    >
                        <div className="space-y-8 text-sm leading-relaxed text-secondary">
                            <section className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8">
                                <h2 className="text-xl font-semibold text-foreground mb-4">Introduction</h2>
                                <p>
                                    Welcome to Trace. We respect your privacy and are committed to protecting your personal data.
                                    This privacy policy explains how we collect, use, disclose, and safeguard your information when
                                    you use our service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Information We Collect</h2>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Personal Information</h3>
                                <p className="mb-4">When you sign in with Google, we collect:</p>
                                <ul className="list-disc pl-6 space-y-2 mb-4">
                                    <li>Your name</li>
                                    <li>Email address</li>
                                    <li>Profile picture</li>
                                    <li>Google account ID</li>
                                </ul>

                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Profile Information</h3>
                                <p className="mb-4">You may provide us with:</p>
                                <ul className="list-disc pl-6 space-y-2 mb-4">
                                    <li>Your interests and preferences</li>
                                    <li>Learning goals</li>
                                    <li>Content preferences</li>
                                    <li>Hobbies and professional information</li>
                                </ul>

                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Usage Data</h3>
                                <p className="mb-4">We automatically collect:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Interaction data (content you like, skip, or bookmark)</li>
                                    <li>Reading/viewing patterns</li>
                                    <li>Time spent on different content types</li>
                                    <li>Device and browser information</li>
                                    <li>IP address and general location</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">How We Use Your Information</h2>
                                <p className="mb-4">We use your information to:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Provide and personalize your content feed</li>
                                    <li>Improve our AI algorithms and content curation</li>
                                    <li>Understand your preferences and adapt to your interests</li>
                                    <li>Communicate with you about service updates</li>
                                    <li>Analyze and improve our service</li>
                                    <li>Ensure security and prevent fraud</li>
                                    <li>Comply with legal obligations</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Data Sharing and Disclosure</h2>
                                <p className="mb-4">We do not sell your personal information. We may share your data with:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li><strong>Service Providers:</strong> Third-party services that help us operate (e.g., Firebase, cloud hosting)</li>
                                    <li><strong>Analytics Partners:</strong> To understand usage patterns (anonymized where possible)</li>
                                    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Data Security</h2>
                                <p>
                                    We implement appropriate technical and organizational measures to protect your personal data.
                                    However, no method of transmission over the internet is 100% secure. While we strive to protect
                                    your information, we cannot guarantee absolute security.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Your Rights</h2>
                                <p className="mb-4">You have the right to:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Access your personal data</li>
                                    <li>Correct inaccurate data</li>
                                    <li>Request deletion of your data</li>
                                    <li>Export your data</li>
                                    <li>Opt out of certain data collection</li>
                                    <li>Withdraw consent at any time</li>
                                </ul>
                                <p className="mt-4">
                                    To exercise these rights, please contact us at yourtrace.online@gmail.com
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Subscriptions and Billing</h2>
                                <p className="mb-4">
                                    Trace offers paid subscription plans (weekly, monthly, and yearly) that unlock personalized feed access and AI summaries.
                                    All billing is handled securely through the respective platform (Google Play or Stripe/Dodo Payments for web).
                                </p>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Free Trial</h3>
                                <p className="mb-4">
                                    We offer a free trial period for new subscribers. No charge is made during the trial. If you do not cancel before the trial ends, your subscription will automatically begin and payment will be charged.
                                </p>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Cancellation</h3>
                                <p className="mb-4">
                                    You may cancel your subscription at any time through your Google Play account settings or the web account portal. Cancellation takes effect at the end of the current billing period. We do not offer refunds for partial subscription periods.
                                </p>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Billing Data</h3>
                                <p>
                                    We do not store your payment card details. All payment processing is handled by Google Play Billing or our web payment processor. We receive only confirmation of your subscription status.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Cookies and Tracking</h2>
                                <p>
                                    We use cookies and similar tracking technologies to maintain your session, remember your preferences,
                                    and analyze usage patterns. You can control cookies through your browser settings.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Third-Party Links</h2>
                                <p>
                                    Our service contains links to external content (YouTube, GitHub, research papers, etc.). We are not
                                    responsible for the privacy practices of these external sites. We encourage you to review their
                                    privacy policies.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Children&apos;s Privacy</h2>
                                <p>
                                    Our service is not intended for children under 13 years of age. We do not knowingly collect personal
                                    information from children under 13. If you believe we have collected such information, please contact us.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Changes to This Policy</h2>
                                <p>
                                    We may update this privacy policy from time to time. We will notify you of significant changes by
                                    posting the new policy on this page and updating the &quot;Last Updated&quot; date. We encourage you to review
                                    this policy periodically.
                                </p>
                            </section>

                            <section className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8">
                                <h2 className="text-xl font-semibold text-foreground mb-4">Contact Us</h2>
                                <p className="mb-4">
                                    If you have questions or concerns about this privacy policy, data deletion requests, or subscription issues, please contact us:
                                </p>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5">
                                    <p className="mb-2"><strong>Email:</strong> <a href="mailto:yourtrace.online@gmail.com" className="text-primary hover:underline">yourtrace.online@gmail.com</a></p>
                                    <p className="mb-2"><strong>Contact page:</strong> <a href="https://www.yourtrace.online/contact" className="text-primary hover:underline">yourtrace.online/contact</a></p>
                                    <p className="mb-2"><strong>Twitter:</strong> <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@tarat_211</a></p>
                                    <p><strong>GitHub:</strong> <a href="https://github.com/TarunTomar122" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">TarunTomar122</a></p>
                                </div>
                            </section>

                            <section className="pt-8 mt-8">
                                <p className="text-sm text-secondary/60 text-center">
                                    By using Trace, you acknowledge that you have read and understood this Privacy Policy.
                                </p>
                            </section>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 bg-background border-t border-gray-100 dark:border-gray-800">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <p className="text-sm text-secondary">
                        © 2026 Trace — Built with intention
                    </p>
                </div>
            </footer>
        </div>
    );
}
