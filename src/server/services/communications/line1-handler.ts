// ============================================================================
// Line 1 Automated Response Handler
// Handles lower-complexity complaints with AI-assisted responses
// ============================================================================

import { createLogger } from '../../utils/logger';
import { getAiService } from '../ai/ai-service';

const logger = createLogger('line1-handler');

export interface Line1Context {
  complaintId: string;
  tenantId: string;
  summary: string;
  category: string;
  riskLevel: string;
  businessName: string;
  businessEmail?: string;
  complainantEmail: string;
  complainantFirstName: string;
  issues: string[];
}

export interface Line1DraftResult {
  complainantResponse: {
    subject: string;
    body: string;
    confidence: number;
  };
  businessNotice: {
    subject: string;
    body: string;
    responseDeadlineDays: number;
    confidence: number;
  } | null;
}

/**
 * Line 1 Handler
 *
 * For complaints routed to Line 1 (lower complexity/risk):
 * 1. Generate AI-drafted response to complainant
 * 2. Optionally generate business contact notice
 * 3. Present drafts for human review (never auto-send without approval)
 * 4. Track business response within SLA
 * 5. Escalate to Line 2 if unresolved within SLA
 */
export class Line1Handler {
  private aiService = getAiService();

  /**
   * Generate all Line 1 draft communications for a complaint.
   * All drafts require human approval before sending.
   */
  async generateDrafts(context: Line1Context): Promise<Line1DraftResult> {
    logger.info(`Generating Line 1 drafts for complaint ${context.complaintId}`);

    // Draft response to complainant
    const { result: complainantDraft } = await this.aiService.draftComplainantResponse(
      context.summary,
      context.category,
      context.riskLevel,
    );

    // Draft business notice if business email available
    let businessNotice = null;
    if (context.businessEmail) {
      const { result: businessDraft } = await this.aiService.draftBusinessNotice(
        context.summary,
        context.businessName,
        context.category,
        context.issues.join(', '),
      );
      businessNotice = businessDraft as Line1DraftResult['businessNotice'];
    }

    return {
      complainantResponse: complainantDraft as Line1DraftResult['complainantResponse'],
      businessNotice,
    };
  }

  /**
   * Check if a Line 1 complaint should be escalated based on SLA.
   */
  shouldEscalate(
    complaintCreatedAt: Date,
    businessResponseDays: number,
    hasBusinessResponded: boolean,
  ): { shouldEscalate: boolean; reason: string } {
    if (hasBusinessResponded) {
      return { shouldEscalate: false, reason: '' };
    }

    const now = new Date();
    const daysSinceCreation = (now.getTime() - complaintCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > businessResponseDays) {
      return {
        shouldEscalate: true,
        reason: `Business has not responded within ${businessResponseDays} day SLA (${Math.floor(daysSinceCreation)} days elapsed)`,
      };
    }

    return { shouldEscalate: false, reason: '' };
  }
}
