// src/lib/srs.ts

export type SRSStatus = "learning" | "review" | "relearning";
export type SRSRating = "again" | "hard" | "good" | "easy";

export interface SRSCardData {
  interval: number; // Days until next review
  repetition: number; // Number of successful reviews in a row
  easeFactor: number; // Difficulty multiplier (default 2.5)
  nextReview: number; // Timestamp
}

export const INITIAL_CARD_DATA: SRSCardData = {
  interval: 0,
  repetition: 0,
  easeFactor: 2.5,
  nextReview: Date.now(),
};

/**
 * SuperMemo-2 (SM-2) Algorithm implementation
 */
export function calculateNextReview(
  current: SRSCardData,
  rating: SRSRating
): SRSCardData {
  let { interval, repetition, easeFactor } = current;

  // Rating mapping: Again=0, Hard=3, Good=4, Easy=5
  // (Simplified mapping for better UX)
  let quality = 0;
  switch (rating) {
    case "again": quality = 0; break;
    case "hard": quality = 3; break;
    case "good": quality = 4; break;
    case "easy": quality = 5; break;
  }

  if (quality >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  } else {
    // Incorrect response
    repetition = 0;
    interval = 1;
  }

  // Update Ease Factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // Calculate next date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    interval,
    repetition,
    easeFactor,
    nextReview: nextReviewDate.getTime(),
  };
}