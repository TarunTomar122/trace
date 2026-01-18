import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Webhook } from 'standardwebhooks';

// Dodo Payments webhook handler
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Get webhook headers for verification
    const webhookId = request.headers.get('webhook-id');
    const webhookTimestamp = request.headers.get('webhook-timestamp');
    const webhookSignature = request.headers.get('webhook-signature');

    // Verify webhook signature
    const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET && webhookId && webhookTimestamp && webhookSignature) {
      try {
        const webhook = new Webhook(WEBHOOK_SECRET);
        await webhook.verify(rawBody, {
          'webhook-id': webhookId,
          'webhook-timestamp': webhookTimestamp,
          'webhook-signature': webhookSignature,
        });
      } catch (error) {
        console.error('Webhook verification failed:', error);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('Webhook verification skipped - missing secret or headers');
    }

    // Extract event data
    const eventType = body.type;
    const eventData = body.data;

    console.log(`Received webhook: ${eventType}`, {
      subscriptionId: eventData.subscription_id,
      customerId: eventData.customer?.email,
      userId: eventData.metadata?.user_id,
    });

    // Get user ID from metadata
    const userId = eventData.metadata?.user_id;
    if (!userId) {
      console.error('No user_id in webhook metadata');
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    if (!adminDb) throw new Error('Firestore not initialized');
    const userRef = adminDb.collection('user_profiles').doc(userId);

    // Handle different subscription events
    switch (eventType) {
      case 'subscription.created':
        // Subscription created (in trial or active)
        await userRef.update({
          subscriptionStatus: eventData.trial_end ? 'trial' : 'active',
          subscriptionId: eventData.subscription_id,
          dodoCustomerId: eventData.customer_id,
          planId: eventData.product_id,
          trialEndDate: eventData.trial_end ? new Date(eventData.trial_end) : null,
          nextBillingDate: eventData.current_period_end ? new Date(eventData.current_period_end) : null,
          updatedAt: new Date(),
        });
        console.log(`Subscription created for user ${userId}: ${eventData.subscription_id}`);
        
        // Trigger feed generation for new subscriber
        try {
          const onboardResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/onboard`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid: userId }),
          });
          
          if (onboardResponse.ok) {
            console.log(`Feed generation triggered for newly subscribed user ${userId}`);
          } else {
            console.error(`Failed to trigger feed generation for user ${userId}`);
          }
        } catch (error) {
          console.error(`Error triggering feed generation for user ${userId}:`, error);
          // Don't fail the webhook if feed generation fails
        }
        break;

      case 'subscription.active':
        // Subscription became active (trial ended or new subscription)
        await userRef.update({
          subscriptionStatus: 'active',
          subscriptionId: eventData.subscription_id,
          nextBillingDate: eventData.current_period_end ? new Date(eventData.current_period_end) : null,
          trialEndDate: null, // Trial is over
          updatedAt: new Date(),
        });
        console.log(`Subscription activated for user ${userId}`);
        break;

      case 'subscription.renewed':
      case 'payment.succeeded':
        // Subscription renewed successfully
        if (eventData.subscription_id) {
          await userRef.update({
            subscriptionStatus: 'active',
            lastPaymentDate: new Date(),
            nextBillingDate: eventData.current_period_end ? new Date(eventData.current_period_end) : null,
            updatedAt: new Date(),
          });
          console.log(`Subscription renewed for user ${userId}`);
        }
        break;

      case 'subscription.on_hold':
        // Payment failed, subscription on hold
        await userRef.update({
          subscriptionStatus: 'on_hold',
          updatedAt: new Date(),
        });
        console.log(`Subscription on hold for user ${userId}`);
        // TODO: Send email notification to user
        break;

      case 'payment.failed':
        // Payment failed
        if (eventData.subscription_id) {
          await userRef.update({
            subscriptionStatus: 'on_hold',
            updatedAt: new Date(),
          });
          console.log(`Payment failed for user ${userId}`);
          // TODO: Send email notification to user
        }
        break;

      case 'subscription.cancelled':
        // Subscription cancelled
        await userRef.update({
          subscriptionStatus: 'cancelled',
          updatedAt: new Date(),
        });
        console.log(`Subscription cancelled for user ${userId}`);
        break;

      case 'subscription.expired':
        // Subscription expired (cancelled and period ended)
        await userRef.update({
          subscriptionStatus: 'expired',
          subscriptionId: null,
          nextBillingDate: null,
          updatedAt: new Date(),
        });
        console.log(`Subscription expired for user ${userId}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, webhook-id, webhook-signature, webhook-timestamp',
    },
  });
}

