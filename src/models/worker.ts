export type WorkerStatus = 'top-performer' | 'steady' | 'at-risk';

export interface WorkerRatingEntry {
  category: string;
  score: number;
  note?: string;
  reviewer: string;
  ratedAt: string;
}

export interface WorkerProfile {
  id: string;
  name: string;
  jobCategories: string[];
  ratings: WorkerRatingEntry[];
  strengths: string[];
  weaknesses: string[];
  overallStatus: WorkerStatus;
  overallScore: number;
}

export const STATUS_THRESHOLDS = {
  topPerformerMin: 4.2,
  atRiskMax: 2.5,
};

export function computeOverallScore(ratings: WorkerRatingEntry[]): number {
  if (ratings.length === 0) {
    return 0;
  }

  const total = ratings.reduce((sum, rating) => sum + rating.score, 0);
  return Number((total / ratings.length).toFixed(2));
}

export function resolveWorkerStatus(
  overallScore: number,
  thresholds: typeof STATUS_THRESHOLDS = STATUS_THRESHOLDS,
): WorkerStatus {
  if (overallScore >= thresholds.topPerformerMin) {
    return 'top-performer';
  }

  if (overallScore <= thresholds.atRiskMax) {
    return 'at-risk';
  }

  return 'steady';
}

export function buildWorkerProfile(
  input: Omit<WorkerProfile, 'overallScore' | 'overallStatus'>,
  thresholds?: typeof STATUS_THRESHOLDS,
): WorkerProfile {
  const overallScore = computeOverallScore(input.ratings);

  return {
    ...input,
    overallScore,
    overallStatus: resolveWorkerStatus(overallScore, thresholds ?? STATUS_THRESHOLDS),
  };
}
