import "server-only";
import type { AppUser } from "./auth";
import { canViewFeedbackResults } from "./feedback";

/** مين يشوف نتائج التقييم: شخص واحد بس، من FEEDBACK_RESULTS_USER في .env (الافتراضي في lib/feedback.ts) */
export function isFeedbackViewer(u: Pick<AppUser, "email"> | null | undefined): boolean {
  return !!u && canViewFeedbackResults(u.email, process.env.FEEDBACK_RESULTS_USER);
}
