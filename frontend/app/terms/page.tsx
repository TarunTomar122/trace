"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="flex items-center justify-between py-4">
                        <Link href="/" className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-secondary hover:text-primary transition-colors">
                            <ArrowLeft size={16} />
                            Back to Home
                        </Link>
                        <div className="text-lg text-foreground uppercase flex items-center gap-3 tracking-[0.15em] font-serif font-black">
                            <img
                                src="/trace.png"
                                alt="Trace Logo"
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
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 border-2 border-primary flex items-center justify-center">
                                <FileText className="text-primary" size={24} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h1 className="text-4xl md:text-6xl font-serif font-light tracking-tighter text-foreground uppercase">
                                    Terms of Service
                                </h1>
                            </div>
                        </div>
                        <p className="text-xs font-mono uppercase tracking-widest text-secondary mt-2">
                            Last Updated: January 18, 2026
                        </p>
                    </motion.div>

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="prose prose-sm md:prose-base max-w-none"
                    >
                        <div className="space-y-8 font-mono text-sm leading-relaxed text-secondary">
                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Acceptance of Terms</h2>
                                <p>
                                    By accessing or using Trace (&quot;the Service&quot;), you agree to be bound by these Terms of Service
                                    (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Description of Service</h2>
                                <p>
                                    Trace is a personalized content curation platform that uses artificial intelligence to deliver
                                    relevant content from various sources including YouTube, GitHub, research papers, and web articles.
                                    The Service adapts to your interests and learning patterns to provide a customized feed.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">User Accounts</h2>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Registration</h3>
                                <p className="mb-4">
                                    To use certain features of the Service, you must register using Google authentication. You agree to:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Provide accurate and complete information</li>
                                    <li>Maintain the security of your account</li>
                                    <li>Notify us immediately of any unauthorized access</li>
                                    <li>Be responsible for all activities under your account</li>
                                </ul>

                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3 mt-6">Eligibility</h3>
                                <p>
                                    You must be at least 13 years old to use the Service. By using the Service, you represent that
                                    you meet this age requirement.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Acceptable Use</h2>
                                <p className="mb-4">You agree not to:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Use the Service for any illegal purpose or in violation of any laws</li>
                                    <li>Attempt to gain unauthorized access to the Service or its systems</li>
                                    <li>Interfere with or disrupt the Service or servers</li>
                                    <li>Use automated means to access the Service without permission</li>
                                    <li>Impersonate any person or entity</li>
                                    <li>Collect or harvest information about other users</li>
                                    <li>Upload or transmit viruses or malicious code</li>
                                    <li>Abuse, harass, or harm other users</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Content</h2>
                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">Third-Party Content</h3>
                                <p className="mb-4">
                                    The Service curates and links to content from third-party sources. We do not own, control, or
                                    endorse this content. You acknowledge that:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mb-4">
                                    <li>Third-party content is subject to the terms and conditions of its source</li>
                                    <li>We are not responsible for the accuracy, legality, or availability of third-party content</li>
                                    <li>You use third-party content at your own risk</li>
                                </ul>

                                <h3 className="text-lg font-serif font-light text-foreground uppercase mb-3">User Data</h3>
                                <p>
                                    Your interactions, preferences, and profile information remain your property. By using the Service,
                                    you grant us a limited license to use this data to provide and improve the Service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Intellectual Property</h2>
                                <p className="mb-4">
                                    The Service, including its design, features, and functionality, is owned by Trace and protected by
                                    copyright, trademark, and other intellectual property laws. You may not:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Copy, modify, or create derivative works of the Service</li>
                                    <li>Reverse engineer or attempt to extract source code</li>
                                    <li>Remove or alter any proprietary notices</li>
                                    <li>Use the Service's branding without permission</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Service Availability</h2>
                                <p>
                                    We strive to provide continuous service but do not guarantee that the Service will be uninterrupted,
                                    secure, or error-free. We reserve the right to:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Modify or discontinue the Service at any time</li>
                                    <li>Perform maintenance and updates</li>
                                    <li>Implement changes to features or functionality</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Termination</h2>
                                <p className="mb-4">
                                    We may terminate or suspend your access to the Service immediately, without notice, for:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mb-4">
                                    <li>Violation of these Terms</li>
                                    <li>Illegal or fraudulent activity</li>
                                    <li>Abuse of the Service or other users</li>
                                    <li>Any other reason we deem appropriate</li>
                                </ul>
                                <p>
                                    You may terminate your account at any time by contacting us. Upon termination, your right to
                                    access the Service will cease immediately.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Disclaimers</h2>
                                <p className="mb-4">
                                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
                                    OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Warranties of merchantability or fitness for a particular purpose</li>
                                    <li>Accuracy, reliability, or completeness of content</li>
                                    <li>Uninterrupted or error-free operation</li>
                                    <li>Security or freedom from viruses or harmful components</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Limitation of Liability</h2>
                                <p>
                                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRACE AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY
                                    INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
                                    LOSS OF PROFITS, DATA, OR USE, ARISING FROM YOUR USE OF THE SERVICE.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Indemnification</h2>
                                <p>
                                    You agree to indemnify and hold harmless Trace and its affiliates from any claims, damages, losses,
                                    liabilities, and expenses (including legal fees) arising from:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Your use of the Service</li>
                                    <li>Your violation of these Terms</li>
                                    <li>Your violation of any rights of another party</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Changes to Terms</h2>
                                <p>
                                    We reserve the right to modify these Terms at any time. We will notify users of significant changes
                                    by updating the &quot;Last Updated&quot; date and posting the new Terms. Your continued use of the Service
                                    after changes constitutes acceptance of the modified Terms.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Governing Law</h2>
                                <p>
                                    These Terms shall be governed by and construed in accordance with applicable laws, without regard
                                    to conflict of law provisions. Any disputes arising from these Terms or the Service shall be
                                    resolved through binding arbitration.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-serif font-light text-foreground uppercase mb-4">Contact Information</h2>
                                <p className="mb-4">
                                    If you have questions about these Terms of Service, please contact us:
                                </p>
                                <div className="border border-border p-6 bg-background">
                                    <p className="mb-2"><strong>Email:</strong> tomartarun2001@gmail.com</p>
                                    <p className="mb-2"><strong>Twitter:</strong> <a href="https://x.com/tarat_211" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@tarat_211</a></p>
                                    <p><strong>GitHub:</strong> <a href="https://github.com/TarunTomar122" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">TarunTomar122</a></p>
                                </div>
                            </section>

                            <section className="border-t border-border pt-8 mt-12">
                                <p className="text-xs uppercase tracking-widest text-secondary/60">
                                    By using Trace, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                                </p>
                            </section>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 bg-background border-t border-border">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <p className="text-xs font-mono uppercase tracking-widest text-secondary">
                        © 2026 TRACE // BUILT WITH INTENTION
                    </p>
                </div>
            </footer>
        </div>
    );
}

