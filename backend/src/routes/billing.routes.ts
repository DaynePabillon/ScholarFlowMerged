import { Router, Response, Request } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

const PLANS: Record<string, { name: string; price_monthly: number; price_annual: number; seats: number; features: string[] }> = {
  free: {
    name: 'Free',
    price_monthly: 0,
    price_annual: 0,
    seats: 5,
    features: ['5 seats', 'Basic Kanban', 'Google Sheets sync', '1 active project']
  },
  standard: {
    name: 'Standard',
    price_monthly: 1200,
    price_annual: 11520,
    seats: 20,
    features: ['20 seats', 'Full Kanban + Gantt', 'Google & MS365 sync', 'Unlimited projects', 'Email alerts']
  },
  pro: {
    name: 'Pro',
    price_monthly: 3000,
    price_annual: 28800,
    seats: 100,
    features: ['100 seats', 'Everything in Standard', 'Stripe billing', 'Priority support', 'PDF/Doc exports', 'AI insights']
  },
  enterprise: {
    name: 'Enterprise',
    price_monthly: 0,
    price_annual: 0,
    seats: 9999,
    features: ['Unlimited seats', 'Everything in Pro', 'Custom integrations', 'SLA', 'Dedicated support', 'Custom contracts']
  }
};

// GET /api/billing/plans — public, no auth needed
router.get('/billing/plans', (_req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

// GET /api/billing/subscription?organization_id=
router.get('/billing/subscription', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    if (!organization_id) return res.status(400).json({ error: 'organization_id is required' });

    const result = await query(
      `SELECT s.*, om.seat_count as member_count
       FROM subscriptions s
       LEFT JOIN (
         SELECT organization_id, COUNT(*) as seat_count
         FROM organization_members WHERE status = 'active'
         GROUP BY organization_id
       ) om ON om.organization_id = s.organization_id
       WHERE s.organization_id = $1`,
      [organization_id]
    );

    if (result.rows.length === 0) {
      // Return default free plan if no subscription record
      return res.json({
        subscription: {
          plan: 'free',
          status: 'active',
          seat_count: 5,
          member_count: 0
        }
      });
    }

    res.json({ subscription: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// GET /api/billing/history?organization_id=
router.get('/billing/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    if (!organization_id) return res.status(400).json({ error: 'organization_id is required' });

    const result = await query(
      `SELECT * FROM billing_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [organization_id]
    );

    res.json({ events: result.rows });
  } catch (error) {
    logger.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// POST /api/billing/checkout — create Stripe checkout session
router.post('/billing/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id, plan, billing_cycle } = req.body;

    if (!organization_id || !plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'organization_id and valid plan are required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment variables.',
        configured: false
      });
    }

    // Dynamically load Stripe to avoid crash when key is missing
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any });

    // Get or create Stripe customer
    let existingCustomer = await query(
      `SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1`,
      [organization_id]
    );

    let customerId = existingCustomer.rows[0]?.stripe_customer_id;

    if (!customerId) {
      const orgResult = await query(`SELECT name FROM organizations WHERE id = $1`, [organization_id]);
      const customer = await stripe.customers.create({ name: orgResult.rows[0]?.name, metadata: { organization_id } });
      customerId = customer.id;
    }

    const priceId = billing_cycle === 'annual'
      ? process.env[`STRIPE_PRICE_${plan.toUpperCase()}_ANNUAL`]
      : process.env[`STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY`];

    if (!priceId) {
      return res.status(400).json({ error: `No Stripe price configured for plan "${plan}" (${billing_cycle})` });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?billing=cancel`,
      metadata: { organization_id, plan, billing_cycle }
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (error: any) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal — Stripe customer portal (manage subscription)
router.post('/billing/portal', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.body;

    const subResult = await query(
      `SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1`,
      [organization_id]
    );

    const customerId = subResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this organization' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe not configured', configured: false });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings?tab=billing`
    });

    res.json({ url: session.url });
  } catch (error: any) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

// POST /api/billing/webhook — Stripe webhook handler
router.post('/billing/webhook', express_raw(), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ received: true }); // Silently ignore if not configured
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any });

    const event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);

    logger.info(`Stripe webhook received: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const { organization_id, plan, billing_cycle } = session.metadata;

      await query(
        `INSERT INTO subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, plan, status, billing_cycle)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (organization_id) DO UPDATE
           SET stripe_customer_id = EXCLUDED.stripe_customer_id,
               stripe_subscription_id = EXCLUDED.stripe_subscription_id,
               plan = EXCLUDED.plan,
               status = 'active',
               billing_cycle = EXCLUDED.billing_cycle,
               updated_at = NOW()`,
        [organization_id, session.customer, session.subscription, plan, billing_cycle]
      );

      await query(
        `INSERT INTO billing_events (organization_id, stripe_event_id, event_type, amount_cents, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [organization_id, event.id, event.type, session.amount_total, `Subscribed to ${plan} plan`]
      );
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as any;
      await query(
        `UPDATE subscriptions SET status = $1, updated_at = NOW()
         WHERE stripe_subscription_id = $2`,
        [sub.status, sub.id]
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any;
      await query(
        `UPDATE subscriptions SET status = 'canceled', plan = 'free', updated_at = NOW()
         WHERE stripe_subscription_id = $2`,
        [sub.id]
      );
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any;
      const customer = invoice.customer as string;
      const subResult = await query(
        `SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`, [customer]
      );
      if (subResult.rows.length > 0) {
        await query(
          `INSERT INTO billing_events (organization_id, stripe_event_id, event_type, amount_cents, invoice_url, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [subResult.rows[0].organization_id, event.id, event.type, invoice.amount_paid, invoice.hosted_invoice_url, 'Payment succeeded']
        );
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Helper to get raw body for webhook signature verification
function express_raw() {
  return (req: Request, _res: Response, next: Function) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      (req as any).rawBody = data;
      (req as any).body = data;
      next();
    });
  };
}

export default router;
