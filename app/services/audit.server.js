import prisma from "../db.server";

// Audit logging service for tracking admin actions
// Critical for security compliance and monitoring

export async function logAuditEvent({
  action,
  adminEmail,
  shopDomain,
  details,
  ipAddress,
  userAgent
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        adminEmail,
        shopDomain,
        details,
        ipAddress,
        userAgent,
      }
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export async function logAdminLogin({ adminEmail, ipAddress, userAgent }) {
  await logAuditEvent({
    action: "login",
    adminEmail,
    ipAddress,
    userAgent,
    details: "Admin login successful"
  });
}

export async function logFailedLogin({ email, ipAddress, userAgent }) {
  await logAuditEvent({
    action: "failed_login",
    adminEmail: email,
    ipAddress,
    userAgent,
    details: "Admin login failed"
  });
}

export async function logMerchantUpdate({ adminEmail, shopDomain, details }) {
  await logAuditEvent({
    action: "merchant_update",
    adminEmail,
    shopDomain,
    details
  });
}

export async function logBillingChange({ adminEmail, shopDomain, details }) {
  await logAuditEvent({
    action: "billing_change",
    adminEmail,
    shopDomain,
    details
  });
}

export async function logAnnouncement({ adminEmail, details }) {
  await logAuditEvent({
    action: "announcement",
    adminEmail,
    details
  });
}

export async function logSubscriptionChange({ adminEmail, shopDomain, details }) {
  await logAuditEvent({
    action: "subscription_change",
    adminEmail,
    shopDomain,
    details
  });
}

export async function getRecentAuditLogs(limit = 50) {
  return await prisma.auditLog.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });
}
