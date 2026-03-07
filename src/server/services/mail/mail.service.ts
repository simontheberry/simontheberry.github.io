// ============================================================================
// Mail Service (Stub)
// ============================================================================

import { createLogger } from '../../utils/logger';

const logger = createLogger('mail-service');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using configured SMTP provider
 * Note: Actual email functionality deferred to Phase 4.2
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  logger.info('Email send requested (stub)', {
    to: options.to,
    subject: options.subject,
  });
  
  // Stub implementation - emails are logged but not sent
  // Full SMTP integration deferred to Phase 4.2
}

/**
 * Send complaint confirmation email
 */
export async function sendComplaintConfirmation(
  email: string,
  referenceNumber: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Your complaint has been received: ${referenceNumber}`,
    html: `<p>Your complaint reference number is: <strong>${referenceNumber}</strong></p>`,
    text: `Your complaint reference number is: ${referenceNumber}`,
  });
}

/**
 * Send status update email
 */
export async function sendStatusUpdate(
  email: string,
  complaintId: string,
  status: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Complaint status update: ${status}`,
    html: `<p>Your complaint status has been updated to: <strong>${status}</strong></p>`,
    text: `Your complaint status has been updated to: ${status}`,
  });
}
