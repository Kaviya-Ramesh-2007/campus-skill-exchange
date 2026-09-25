export const MATCH_REPOSITORY = Symbol('MATCH_REPOSITORY');

export interface SkillReference {
  id: string;
  name: string;
}

export interface UserMatchData {
  userId: string;
  displayName: string;
  teachableSkills: SkillReference[];
  learningGoals: Array<{ id: string; skill: SkillReference }>;
}

export interface MatchData {
  requester: UserMatchData;
  candidates: UserMatchData[];
}

export interface MatchRepository {
  loadMatchData(requesterId: string): Promise<MatchData>;
}
