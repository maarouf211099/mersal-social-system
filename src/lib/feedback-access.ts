import "server-only";
import type { AppUser } from "./auth";
import { canViewFeedbackResults } from "./feedback";

/** مين يشوف نتائج التقييم: أي مدير (admin) + الشخص المحدد في FEEDBACK_RESULTS_USER في .env (الافتراضي في lib/feedback.ts) */
export function isFeedbackViewer(u: Pick<AppUser, "email" | "role"> | null | undefined): boolean {
  return canViewFeedbackResults(u, process.env.FEEDBACK_RESULTS_USER);
}
