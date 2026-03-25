// Central plan configuration.
// Import this anywhere you need to enforce or display plan limits.

export type PlanId = 'starter' | 'plus' | 'pro' | 'enterprise'

export interface PlanConfig {
  id: PlanId
  name: string
  maxUsers: number | null        // null = unlimited
  maxDocuments: number | null    // null = unlimited
  maxIntegrations: number | null // null = unlimited
  aiDailyLimit: boolean          // true = has a daily AI usage cap
  whatsappEnabled: boolean       // Nukor for WhatsApp channel
  apiAccess: boolean
  prioritySupport: boolean
  customOnboarding: boolean
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    maxUsers: 1,
    maxDocuments: 10,
    maxIntegrations: 0,
    aiDailyLimit: true,
    whatsappEnabled: false,
    apiAccess: false,
    prioritySupport: false,
    customOnboarding: false,
  },
  // Previously the 'pro' plan — renamed to Plus, DB value 'pro' maps here via getPlan()
  plus: {
    id: 'plus',
    name: 'Plus',
    maxUsers: 5,
    maxDocuments: 25,
    maxIntegrations: 2,
    aiDailyLimit: false,
    whatsappEnabled: false,
    apiAccess: false,
    prioritySupport: false,
    customOnboarding: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxUsers: 15,
    maxDocuments: 100,
    maxIntegrations: 5,
    aiDailyLimit: false,
    whatsappEnabled: true,
    apiAccess: false,
    prioritySupport: true,
    customOnboarding: false,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    maxUsers: null,
    maxDocuments: null,
    maxIntegrations: null,
    aiDailyLimit: false,
    whatsappEnabled: true,
    apiAccess: true,
    prioritySupport: true,
    customOnboarding: true,
  },
}

/**
 * Returns the plan config for a workspace's current plan string.
 * Legacy DB value 'pro' (old Pro plan) maps to 'plus' until DB migration runs.
 * Defaults to starter.
 */
export function getPlan(planId: string | null | undefined): PlanConfig {
  // Legacy: old 'pro' rows in DB are the renamed Plus plan
  const normalized = planId === 'pro' ? 'plus' : planId
  return PLANS[(normalized as PlanId)] ?? PLANS.starter
}

/** Returns true if the workspace plan allows the given feature. */
export function canUseFeature(
  planId: string | null | undefined,
  feature: keyof Pick<PlanConfig, 'apiAccess' | 'prioritySupport' | 'customOnboarding' | 'whatsappEnabled'>
): boolean {
  return getPlan(planId)[feature]
}

/** Returns true if the workspace is within the user limit. */
export function withinUserLimit(planId: string | null | undefined, currentUsers: number): boolean {
  const limit = getPlan(planId).maxUsers
  return limit === null || currentUsers < limit
}

/** Returns true if the workspace is within the document limit. */
export function withinDocumentLimit(planId: string | null | undefined, currentDocs: number): boolean {
  const limit = getPlan(planId).maxDocuments
  return limit === null || currentDocs < limit
}

/** Returns true if the workspace is within the integration limit. */
export function withinIntegrationLimit(planId: string | null | undefined, currentIntegrations: number): boolean {
  const limit = getPlan(planId).maxIntegrations
  return limit === null || currentIntegrations < limit
}
