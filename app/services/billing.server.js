// Shopify Billing API Architecture
// Prepare billing infrastructure for ScriptPilot SaaS platform

export const BILLING_CONFIG = {
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'EVERY_30_DAYS',
      trialDays: 0,
      features: ['1 active script', 'Basic tracking', 'Email support'],
      limits: { scripts: 1 }
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 4.99,
      interval: 'EVERY_30_DAYS',
      trialDays: 14,
      features: ['5 active scripts', 'All platforms', 'Priority support', 'Advanced targeting'],
      limits: { scripts: 5 }
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 12.99,
      interval: 'EVERY_30_DAYS',
      trialDays: 14,
      features: ['Unlimited scripts', 'All platforms', 'Priority support', 'Advanced targeting', 'Custom integrations', 'Analytics dashboard'],
      limits: { scripts: Infinity }
    }
  ]
};

export function getPlanById(planId) {
  return BILLING_CONFIG.plans.find(plan => plan.id === planId);
}

export function getPlanLimits(planId) {
  const plan = getPlanById(planId);
  return plan ? plan.limits : { scripts: 1 };
}

export function canAddScript(currentPlan, activeScriptCount) {
  const limits = getPlanLimits(currentPlan);
  return activeScriptCount < limits.scripts;
}

export function getRequiredPlanForScriptCount(scriptCount) {
  if (scriptCount <= 1) return 'free';
  if (scriptCount <= 5) return 'basic';
  return 'pro';
}

// Shopify Billing API helpers
export async function createBillingCheckSession({ admin, planId, returnUrl }) {
  const plan = getPlanById(planId);
  
  if (plan.price === 0) {
    // Free plan doesn't require billing
    return { required: false };
  }

  try {
    const response = await admin.rest.resources.BillingCheck.create({
      session: admin.rest.session,
      data: {
        returnUrl,
        test: process.env.NODE_ENV !== 'production'
      }
    });

    return { required: true, response };
  } catch (error) {
    console.error('Billing check error:', error);
    return { required: false, error: error.message };
  }
}

export async function createBillingSubscription({ admin, planId, returnUrl }) {
  const plan = getPlanById(planId);
  
  if (plan.price === 0) {
    // Free plan doesn't require billing
    return { success: true, subscriptionId: null };
  }

  try {
    const response = await admin.rest.resources.RecurringApplicationCharge.create({
      session: admin.rest.session,
      data: {
        name: `${plan.name} Plan`,
        price: plan.price,
        trial_days: plan.trialDays,
        test: process.env.NODE_ENV !== 'production',
        return_url: returnUrl
      }
    });

    return { success: true, subscriptionId: response.body.recurring_application_charge.id };
  } catch (error) {
    console.error('Billing subscription error:', error);
    return { success: false, error: error.message };
  }
}

export async function cancelBillingSubscription({ admin, subscriptionId }) {
  try {
    await admin.rest.resources.RecurringApplicationCharge.delete({
      session: admin.rest.session,
      id: subscriptionId
    });

    return { success: true };
  } catch (error) {
    console.error('Billing cancellation error:', error);
    return { success: false, error: error.message };
  }
}

export async function getBillingStatus({ admin, subscriptionId }) {
  if (!subscriptionId) {
    return { status: 'free', active: true };
  }

  try {
    const response = await admin.rest.resources.RecurringApplicationCharge.find({
      session: admin.rest.session,
      id: subscriptionId
    });

    const charge = response.body.recurring_application_charge;
    
    return {
      status: charge.status,
      active: charge.status === 'active',
      cancelled: charge.status === 'cancelled',
      pending: charge.status === 'pending'
    };
  } catch (error) {
    console.error('Billing status error:', error);
    return { status: 'unknown', active: false };
  }
}

// Plan upgrade/downgrade helpers
export async function upgradePlan({ shopifyDomain, newPlanId, prisma }) {
  const newPlan = getPlanById(newPlanId);
  
  await prisma.shop.update({
    where: { shopifyDomain },
    data: { 
      plan: newPlanId,
      billingStatus: 'active',
      updatedAt: new Date()
    }
  });

  return { success: true, plan: newPlan };
}

export async function downgradePlan({ shopifyDomain, newPlanId, prisma }) {
  const newPlan = getPlanById(newPlanId);
  
  // Check if current active scripts exceed new plan limits
  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain },
    include: { scripts: true }
  });

  const activeScriptCount = shopData?.scripts.filter(s => s.status).length || 0;
  const newLimits = getPlanLimits(newPlanId);

  if (activeScriptCount > newLimits.scripts) {
    return { 
      success: false, 
      error: `Cannot downgrade: You have ${activeScriptCount} active scripts but ${newPlan.name} plan allows ${newLimits.scripts === Infinity ? 'unlimited' : newLimits.scripts}. Disable some scripts first.` 
    };
  }

  await prisma.shop.update({
    where: { shopifyDomain },
    data: { 
      plan: newPlanId,
      billingStatus: 'active',
      updatedAt: new Date()
    }
  });

  return { success: true, plan: newPlan };
}
