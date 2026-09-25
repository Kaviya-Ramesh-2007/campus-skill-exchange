export const REPUTATION_REPOSITORY = Symbol('REPUTATION_REPOSITORY');

export interface AssessmentAveragesRecord {
  understandingScore: number | null;
  practicalApplicationScore: number | null;
  problemSolvingScore: number | null;
  communicationScore: number | null;
  reliabilityScore: number | null;
}

export interface ReputationSummaryRecord {
  userId: string;
  completedSessions: number;
  averageRating: number | null;
  ratingCount: number;
  assessmentCount: number;
  assessmentAverages: AssessmentAveragesRecord;
  badgeCount: number;
}

export interface ReputationRepository {
  userExists(userId: string): Promise<boolean>;
  getSummary(userId: string): Promise<ReputationSummaryRecord>;
}
