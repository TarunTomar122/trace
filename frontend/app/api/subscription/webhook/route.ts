import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Webhook } from 'standardwebhooks';
import { captureServerEvent } from '@/lib/posthog-server';

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
    if (!WEBHOOK_SECRET || !webhookId || !webhookTimestamp || !webhookSignature) {
      console.error('Webhook verification unavailable');
      return NextResponse.json({ error: 'Webhook verification unavailable' }, { status: 503 });
    }
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

    // Extract event data
    const eventType = body.type;
    const eventData = body.data;

    console.log(`Received webhook: ${eventType}`, {
      subscriptionId: eventData.subscription_id,
      customerId: eventData.customer?.email,
      userId: eventData.metadata?.user_id,
      nextBillingDate: eventData.next_billing_date,
      status: eventData.status,
    });

    if (!adminDb) throw new Error('Firestore not initialized');
    const db = adminDb;
    
    // Get user ID from metadata
    let userId = eventData.metadata?.user_id;
    
    // Fallback: If no user_id in metadata, try to find user by subscription_id
    if (!userId && eventData.subscription_id) {
      console.warn('No user_id in metadata, searching by subscription_id:', eventData.subscription_id);
      try {
        const usersSnapshot = await db.collection('user_profiles')
          .where('subscriptionId', '==', eventData.subscription_id)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          userId = usersSnapshot.docs[0].id;
          console.log(`Found user ${userId} by subscription_id`);
        }
      } catch (error) {
        console.error('Error searching for user by subscription_id:', error);
      }
    }
    
    if (!userId) {
      console.error('No user_id in webhook metadata and could not find by subscription_id');
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const userRef = db.collection('user_profiles').doc(userId);

    const recordAffiliateConversion = async () => {
      const affiliateCode = eventData.metadata?.affiliate_code;
      if (!affiliateCode) return;
      const conversionId = eventData.subscription_id || `${userId}_${affiliateCode}`;
      await db.collection('affiliate_conversions').doc(conversionId).set({
        code: String(affiliateCode).toLowerCase(),
        uid: userId,
        subscriptionId: eventData.subscription_id || null,
        checkoutSessionId: eventData.checkout_id || eventData.session_id || null,
        customerId: eventData.customer_id || eventData.customer?.customer_id || null,
        eventType,
        source: 'web_subscription',
        createdAt: new Date(),
      }, { merge: true });

      await userRef.set({
        affiliateCode: String(affiliateCode).toLowerCase(),
        updatedAt: new Date(),
      }, { merge: true });
    };
    
    // Helper: trigger feed generation for a newly subscribed user
    const triggerFeedGeneration = async (reason: string) => {
      try {
        // Check if user has completed onboarding (has interests set)
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        if (!userData?.onboarded) {
          console.log(`Skipping feed generation for user ${userId} - not yet onboarded (reason: ${reason})`);
          return;
        }
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
          console.error(`NEXT_PUBLIC_APP_URL not set! Cannot trigger feed generation for user ${userId} (reason: ${reason})`);
          return;
        }
        
        console.log(`Triggering feed generation for user ${userId} (reason: ${reason}) via ${appUrl}/api/onboard`);
        
        const onboardResponse = await fetch(`${appUrl}/api/onboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: userId }),
        });
        
        if (onboardResponse.ok) {
          const result = await onboardResponse.json();
          if (result.triggered) {
            console.log(`Feed generation DISPATCHED for user ${userId} (reason: ${reason})`);
          } else {
            console.error(`Feed generation NOT dispatched for user ${userId} (reason: ${reason}): ${result.message || result.error || 'triggered=false'}`);
          }
        } else {
          console.error(`Failed to trigger feed generation for user ${userId} (reason: ${reason}): HTTP ${onboardResponse.status}`);
        }
      } catch (error) {
        console.error(`Error triggering feed generation for user ${userId} (reason: ${reason}):`, error);
        // Don't fail the webhook if feed generation fails
      }
    };
    
    const triggerUnsubscribe = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: userId }),
        });
        if (response.ok) {
          console.log(`Unsubscribe cleanup triggered for user ${userId}`);
        } else {
          console.error(`Failed to trigger unsubscribe cleanup for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error triggering unsubscribe cleanup for user ${userId}:`, error);
      }
    };

    // Handle different subscription events
    switch (eventType) {
      case 'subscription.created':
        // Subscription created (in trial or active)
        const hasTrial = eventData.trial_period_days && eventData.trial_period_days > 0;
        let trialEndDate = null;
        if (hasTrial && eventData.created_at) {
          const trialEnd = new Date(eventData.created_at);
          trialEnd.setDate(trialEnd.getDate() + eventData.trial_period_days);
          trialEndDate = trialEnd;
        }
        
        await userRef.update({
          subscriptionStatus: hasTrial ? 'trial' : 'active',
          subscriptionId: eventData.subscription_id,
          dodoCustomerId: eventData.customer_id || eventData.customer?.customer_id,
          planId: eventData.product_id,
          trialEndDate: trialEndDate,
          nextBillingDate: eventData.next_billing_date ? new Date(eventData.next_billing_date) : null,
          updatedAt: new Date(),
        });
        console.log(`Subscription created for user ${userId}: ${eventData.subscription_id}`);
        await captureServerEvent(userId, 'subscription_started', {
          $insert_id: `subscription_started:${eventData.subscription_id}`,
          subscription_status: hasTrial ? 'trial' : 'active',
          pricing_offer: eventData.metadata?.pricing_offer,
          source: 'dodo_webhook',
        });
        await recordAffiliateConversion();
        
        // Trigger feed generation for new subscriber
        await triggerFeedGeneration('subscription.created');
        break;

      case 'subscription.active':
        // Subscription became active (trial ended or new subscription)
        await userRef.update({
          subscriptionStatus: 'active',
          subscriptionId: eventData.subscription_id,
          dodoCustomerId: eventData.customer_id || eventData.customer?.customer_id,
          planId: eventData.product_id,
          nextBillingDate: eventData.next_billing_date ? new Date(eventData.next_billing_date) : null,
          trialEndDate: null, // Trial is over
          updatedAt: new Date(),
        });
        console.log(`Subscription activated for user ${userId}`);
        await captureServerEvent(userId, 'subscription_started', {
          $insert_id: `subscription_started:${eventData.subscription_id}`,
          subscription_status: 'active',
          pricing_offer: eventData.metadata?.pricing_offer,
          source: 'dodo_webhook',
        });
        await recordAffiliateConversion();
        
        // Also trigger feed generation as safety net (in case subscription.created didn't fire or failed)
        await triggerFeedGeneration('subscription.active');
        break;

      case 'subscription.renewed':
      case 'payment.succeeded':
        // Subscription renewed successfully
        if (eventData.subscription_id) {
          await userRef.update({
            subscriptionStatus: 'active',
            lastPaymentDate: new Date(),
            nextBillingDate: eventData.next_billing_date ? new Date(eventData.next_billing_date) : null,
            updatedAt: new Date(),
          });
          console.log(`Subscription renewed for user ${userId}`);
          await captureServerEvent(userId, 'payment_succeeded', {
            $insert_id: `payment_succeeded:${webhookId || eventData.payment_id || eventData.subscription_id}`,
            subscription_id: eventData.subscription_id,
            source: 'dodo_webhook',
          });
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
        // Subscription cancelled (immediate cancellation)
        await userRef.update({
          subscriptionStatus: 'cancelled',
          cancelledAt: eventData.cancelled_at ? new Date(eventData.cancelled_at) : new Date(),
          willCancelAt: null, // Immediate cancellation, no future cancel date
          nextBillingDate: eventData.next_billing_date ? new Date(eventData.next_billing_date) : null,
          updatedAt: new Date(),
        });
        console.log(`Subscription cancelled for user ${userId}`);
        await triggerUnsubscribe();
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
        await triggerUnsubscribe();
        break;

      case 'subscription.updated':
        // Subscription updated (e.g., cancellation, status change, reactivation)
        const cancelAtNextBilling = eventData.cancel_at_next_billing_date;
        const subscriptionStatus = eventData.status;
        
        const updateData: Record<string, unknown> = {
          subscriptionId: eventData.subscription_id,
          dodoCustomerId: eventData.customer_id || eventData.customer?.customer_id,
          planId: eventData.product_id,
          nextBillingDate: eventData.next_billing_date ? new Date(eventData.next_billing_date) : null,
          updatedAt: new Date(),
        };

        // Handle trial dates if present
        if (eventData.trial_period_days && eventData.created_at) {
          const trialEnd = new Date(eventData.created_at);
          trialEnd.setDate(trialEnd.getDate() + eventData.trial_period_days);
          updateData.trialEndDate = trialEnd;
        } else if (eventData.expires_at && subscriptionStatus === 'active') {
          // If expires_at is soon and status is active, might be trial end
          const expiresAt = new Date(eventData.expires_at);
          const now = new Date();
          if (expiresAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
            // Within 7 days, likely trial end
            updateData.trialEndDate = expiresAt;
          }
        }

        // Handle cancellation updates
        if (cancelAtNextBilling) {
          // Subscription set to cancel at period end
          updateData.subscriptionStatus = 'active'; // Still active until period ends
          // Use cancelled_at from payload if available, otherwise use current time
          updateData.cancelledAt = eventData.cancelled_at 
            ? new Date(eventData.cancelled_at) 
            : new Date();
          updateData.willCancelAt = eventData.next_billing_date ? new Date(eventData.next_billing_date) : null;
          console.log(`Subscription set to cancel at period end for user ${userId}`);
        } else if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') {
          // Subscription cancelled or expired immediately
          updateData.subscriptionStatus = subscriptionStatus === 'expired' ? 'expired' : 'cancelled';
          // Use cancelled_at from payload if available, otherwise use current time
          updateData.cancelledAt = eventData.cancelled_at 
            ? new Date(eventData.cancelled_at) 
            : new Date();
          updateData.willCancelAt = null;
          console.log(`Subscription ${subscriptionStatus} for user ${userId}`);
        } else if (subscriptionStatus === 'active') {
          // Active subscription (could be reactivation or status update)
          updateData.subscriptionStatus = 'active';
          // Clear cancellation flags if reactivated (not cancelling)
          if (!cancelAtNextBilling) {
            updateData.cancelledAt = null;
            updateData.willCancelAt = null;
          } else {
            // Still cancelling but status is active - use cancelled_at if available
            if (eventData.cancelled_at) {
              updateData.cancelledAt = new Date(eventData.cancelled_at);
            }
          }
          console.log(`Subscription active for user ${userId}`);
        } else {
          // Other status updates
          updateData.subscriptionStatus = 'on_hold';
          console.log(`Subscription status updated to ${subscriptionStatus} for user ${userId}`);
        }

        await userRef.update(updateData);
        if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') {
          await triggerUnsubscribe();
        } else if (subscriptionStatus === 'active' && !cancelAtNextBilling) {
          // Reactivation or status became active — trigger feed generation as safety net
          await triggerFeedGeneration('subscription.updated (active)');
        }
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
