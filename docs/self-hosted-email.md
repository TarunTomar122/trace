# Self-hosted email (moving off Brevo)

Status: **live and ramping since 2026-09-21.** The VPS runs Postfix as a
loopback-only null client, and `EMAIL_TRANSPORT=auto` on the box means our MTA
carries the send with Brevo as the per-message fallback. DNS (A, PTR, SPF,
DKIM, DMARC) is published, and a DKIM round trip against live DNS verifies.
The warm-up schedule below is still manual: nothing in code caps daily volume.

Rollback in one line: set `EMAIL_TRANSPORT=brevo` in `~/trace/.env` on the VPS
and the next send is Brevo-only again. Nothing else changes.

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
| `smtp` (default) | Local MTA only. An unconfigured run cannot reach Brevo. |
| `brevo` | Brevo only, and only when set explicitly. |
| `auto` | Local MTA, Brevo per the warm-up routing below, per-message fallback. |

The default is deliberately not `brevo`: a load test run without any env used to
spend the production Brevo quota, which is exactly how 300 hard bounces got
charged to the account on 2026-09-22 and starved the newsletter. Reaching Brevo
is now an explicit choice.

Messages to RFC 2606 / RFC 6761 names (`example.com`, anything under `.test`,
`.invalid`, `.localhost`) are dropped with `status: skipped` and
`transport: none` instead of being sent. Nothing can deliver to them, so sending
only bounces and burns quota — the guard exists because a stress run did exactly
that.

`auto` is the ramp mode: an MTA hiccup degrades to Brevo instead of losing the
send. A local MTA failure in `smtp` mode is recorded as failed rather than
silently rerouted.

### Warm-up routing

`auto` also sends some mail through Brevo instead of our IP. Two levers, both
empty by default:

| Variable | Routes to Brevo |
|---|---|
| `EMAIL_BREVO_DOMAINS` | receivers at those domains (`gmail.com,outlook.com`) |
| `EMAIL_BREVO_BUCKETS` | recipients in those audience buckets (`pro`) |

`EMAIL_BREVO_BUCKETS=pro` is the current shape: paying readers go out over
Brevo's established relay while our own IP builds history on the free and
landing buckets. That also keeps the MTA at a low, steady daily volume instead
of one cold blast, which is what Gmail was objecting to (`421-4.7.28 unusual
rate of mail originating from your IP`) on day one.

Add domains to `EMAIL_BREVO_DOMAINS` while a receiver is still policing the new
domain, and drop entries as Postmaster Tools shows reputation recovering.
Neither lever can silently lose mail: `brevo_can_send()` checks the account
balance first and falls back to our own MTA, recording the reason in the send
log's `note`.

Two related warm-up settings:

- `EMAIL_SENDER_BREVO` (default the legacy `yourtrace.online@gmail.com`) is the
  From identity Brevo sends as. That default is a gmail.com address, so no relay
  can align SPF or DKIM for it — which is the very thing this document warns
  about below. Verify `mail.yourtrace.online` in Brevo, then set
  `EMAIL_SENDER_BREVO=newsletter@mail.yourtrace.online` and the Brevo route
  authenticates the same way the MTA route does. Leave it unset until Brevo
  accepts the address: Brevo refuses senders it has not verified.
- `EMAIL_REPLY_TO` (default `support@yourtrace.online`) is the reply path. The
  sending host is a send-only null client — `mail.yourtrace.online` publishes no
  MX — so without it every reply bounces, and a sender nobody can reply to reads
  as bulk.
- `EMAIL_TRACKING=0` drops the open pixel and the redirect-wrapped links. Both
  are bulk-sender tells that a domain with no history cannot afford yet. The
  dashboard's open and click columns read zero while it is off.

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

## Install (done 2026-09-21)

```bash
sudo apt install -y postfix
# inbound: none. Postfix is a null client to the world, local delivery only.
sudo postconf -e 'inet_interfaces = loopback-only'
sudo postconf -e 'mynetworks = 127.0.0.0/8'
sudo postconf -e 'default_destination_rate_delay = 1s'   # never burst at an ISP
sudo postconf -e 'smtp_tls_security_level = may'
sudo postconf -e 'myhostname = mail.yourtrace.online'
sudo systemctl restart postfix
```

DKIM is signed in Python (`dkimpy`, see `v1/tools/email_sender.py`) rather than
by a milter, so OpenDKIM is not needed. The key lives at
`~/trace/secrets/dkim-mail.yourtrace.online.private` (chmod 600) and
`EMAIL_DKIM_KEY` in `~/trace/.env` points at it.

Warm-up is a **schedule, not a switch**. Postfix carries the rate guard rails:
`default_destination_rate_delay` today, and per-destination concurrency limits
(Gmail and Microsoft are the sensitive ones) once volume justifies them.

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

That feeds the dashboard at **`/dev/analytics`** (signed in, dev only): sends
per day, transport split while ramping, failures and Brevo fallbacks, DKIM
status, unique openers and clickers overall and per bucket, the top clicked
targets, and the last 25 sends with whether each one was opened or clicked.
It reads the same LocalDB the pipeline writes to, so the numbers are the real
records, not a separate tally.

Opens are inflated by design: Apple Mail preloads the tracking pixel. Clicks
are the honest engagement signal.

Unsubscribes land on `frontend/app/api/unsubscribe/route.ts` and write real
state: `free_newsletter_subscribers/{email}.active = false` for landing
subscribers, and `dailyNewsletterEnabled`/`newsletterOptIn = false` on any
matching profile. The flow treats an explicit opt-out as final for every
bucket, Pro included. `GET` serves the footer link, `POST ?email=` serves the
RFC 8058 one-click header.

## Risks

1. **Cold-IP spam foldering for the first 1-2 weeks.** Engaged-first ordering and
   a slow ramp are the mitigation; Brevo can carry the at-risk segments.
2. **Disk.** A 10k queue at ~50KB per message is 500MB, and deferred mail
   triples it. The box runs at 99% full; free space before volume climbs.
3. **No feedback loops yet.** Register Google Postmaster Tools and Microsoft
   SNDS, and hard-suppress after 1-2 bounces, or the IP poisons within weeks.
4. **A broken click endpoint breaks every link** because links route through it.
   `EMAIL_TRACKING=0` is the instant fallback.
5. **OVH abuse suspension** if a compromised list or a complaint spike happens.
   Rate limits, honoured unsubscribes, and monitoring are the defence.

## Still to build

1. **Bounce handling.** Nothing reads Postfix's DSNs yet, so a hard bounce is
   only visible in the dashboard as a send that never opened. Needs a
   suppression list consulted before each send.
2. **Feedback loops.** Postmaster Tools and SNDS are not registered, so there is
   no external view of spam rate or reputation.
3. **Ramp enforcement.** The schedule above is a human promise. Nothing caps
   daily volume in code, so the guard rail is watching the dashboard and turning
   `EMAIL_TRANSPORT` down if today's numbers look wrong.
4. **Per-ISP pacing.** `default_destination_rate_delay` is a blanket 1s. Gmail
   and Microsoft deserve their own concurrency limits as volume grows.
5. **Brevo is a single point of failure with a shared quota.** The account is
   the free plan, and tikrr sends from it too, so the 300/day is contended. When
   it runs dry Brevo answers the API with a message id and only then fails
   ("Your account has insufficient credits"), which is why `brevo_can_send()`
   checks the balance before routing anything there. Worth its own account, or a
   paid plan, before the Gmail route depends on it.
