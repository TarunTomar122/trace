# Self-hosted email (moving off Brevo)

Status: **code ready, nothing installed on the VPS yet.** The transport router
ships in `v1/tools/email_sender.py` and defaults to Brevo, so behaviour is
unchanged until we flip a variable.

## Why

Brevo's free tier caps us at 300 emails/day. Paid volume costs money we do not
need to spend: a warmed VPS can carry 10k/day at $0 marginal cost. The trade is
time (a 4-6 week ramp) rather than cash.

## The stack

**Postfix on the VPS, direct-to-MX, with Brevo kept as the fallback transport.**

Runners-up, and why not: Postal carries open/click tracking and bounce handling
but needs MySQL + RabbitMQ + Redis (3GB+ RAM) for a solo operator; Stalwart and
Maddy are tidier all-in-ones but give up Postfix's per-ISP queue controls, which
is the part that actually protects the IP; Haraka is fast but you assemble
deliverability yourself.

Transport selection lives in one place:

| `EMAIL_TRANSPORT` | Behaviour |
|---|---|
| `brevo` (default) | Brevo only. Nothing changes. |
| `smtp` | Local MTA only. |
| `auto` | Use the local MTA when reachable, fall back to Brevo per message. |

`auto` is the ramp mode: an MTA hiccup degrades to Brevo instead of losing the
send. A local MTA failure in `smtp` mode is recorded as failed rather than
silently rerouted.

## DNS (do this before warming — it is the part that cannot be rushed)

| Record | Value | Why |
|---|---|---|
| `A mail.yourtrace.online` | `144.217.6.112` | the sending host |
| PTR (OVH panel) | `mail.yourtrace.online` | forward and reverse must match the HELO |
| SPF (on the sending subdomain) | `v=spf1 ip4:144.217.6.112 include:spf.brevo.com ~all` | our IP plus Brevo for the fallback |
| DKIM | 2048-bit, selector `s1._domainkey.mail.yourtrace.online` | sign what we send |
| DMARC | `v=DMARC1; p=none; rua=mailto:tomartarun2001@gmail.com` | start at `none`, move to `quarantine` after 2-4 clean weeks, then `reject` |

**Stop sending `From: yourtrace.online@gmail.com`.** A Gmail `From:` breaks DMARC
alignment and will be filtered. Switch to `newsletter@mail.yourtrace.online`
(already the default in `email_sender.py` via `EMAIL_SENDER_LOCAL`). Use a
subdomain so a reputation problem never touches the root domain.

## Install (run only when approved)

```bash
sudo apt install -y postfix opendkim opendkim-tools
# inbound: none. Postfix is a null client to the world, local delivery only.
sudo postconf -e 'inet_interfaces = loopback-only'
sudo postconf -e 'mynetworks = 127.0.0.0/8'
sudo postconf -e 'default_destination_rate_delay = 1s'   # never burst at an ISP
sudo postconf -e 'smtp_tls_security_level = may'
sudo systemctl restart postfix
```

Warm-up is a **schedule, not a switch**. Guard rails to keep in `main.cf`:
per-destination concurrency limits (Gmail and Microsoft are the sensitive ones),
`default_destination_rate_delay`, and a queue that lives on disk and is watched.

## Warm-up schedule

| Days | Volume/day | Note |
|---|---|---|
| 1-3 | 50-100 | today's real list is 65, so start here naturally |
| 4-7 | 200-400 | double every 1-2 days |
| 8-14 | 500-1,000 | 1k/day reached |
| 15-21 | 1,500-3,000 | |
| 22-30 | 4,000-6,000 | |
| 31-45 | 8,000-10,000 | 10k/day reached |

Send to the most engaged readers first. **Pause the ramp if** bounces exceed 2%,
complaints exceed 0.1%, or the Gmail Postmaster spam rate passes 0.3%.

## Watching it

Every attempt is written to `email_sends` (recipient, bucket, transport, status,
message id, tracking id) by `email_sender.py`. Opens and clicks are recorded in
`email_events` by `frontend/app/api/email/track/route.ts`, and the email's own
links are wrapped through that endpoint when `EMAIL_TRACKING` is on (`0` turns
it off; unsubscribe and profile links are never wrapped).

That gives the dashboard: volume per day, transport split while ramping, bounce
and failure rate, opens and clicks per bucket.

## Risks

1. **Cold-IP spam foldering for the first 1-2 weeks.** Engaged-first ordering and
   a slow ramp are the mitigation; Brevo can carry the at-risk segments.
2. **Disk.** A 10k queue at ~50KB per message is 500MB, and deferred mail
   triples it. The box is at 98% full; free space before going live.
3. **No feedback loops yet.** Register Google Postmaster Tools and Microsoft
   SNDS, and hard-suppress after 1-2 bounces, or the IP poisons within weeks.
4. **A broken click endpoint breaks every link** because links route through it.
   `EMAIL_TRACKING=0` is the instant fallback.
5. **OVH abuse suspension** if a compromised list or a complaint spike happens.
   Rate limits, honoured unsubscribes, and monitoring are the defence.
