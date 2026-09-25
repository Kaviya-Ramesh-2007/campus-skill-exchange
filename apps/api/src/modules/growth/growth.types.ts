import type {
  Availability,
  Certification,
  CertificationStatus,
  CreateAvailabilityRequest,
  CreateCertificationRequest,
  CreateLearningGoalRequest,
  CreateProjectRequest,
  LearningGoal,
  LearningPriority,
  Project,
  SkillProficiency,
  UpdateAvailabilityRequest,
  UpdateCertificationRequest,
  UpdateLearningGoalRequest,
  UpdateProjectRequest,
  DayOfWeek,
} from '@campus-skill-exchange/contracts';

export const GROWTH_REPOSITORY = Symbol('GROWTH_REPOSITORY');

export interface LearningGoalRecord extends Omit<LearningGoal, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}
export interface AvailabilityRecord extends Omit<Availability, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}
export interface CertificationRecord extends Omit<
  Certification,
  'createdAt' | 'updatedAt' | 'issueDate' | 'expiryDate'
> {
  issueDate: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProjectRecord extends Omit<
  Project,
  'createdAt' | 'updatedAt' | 'startDate' | 'endDate'
> {
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrowthRepository {
  listLearningGoals(userId: string): Promise<LearningGoalRecord[]>;
  createLearningGoal(userId: string, input: CreateLearningGoalRequest): Promise<LearningGoalRecord>;
  updateLearningGoal(
    id: string,
    userId: string,
    input: UpdateLearningGoalRequest,
  ): Promise<LearningGoalRecord | null>;
  deleteLearningGoal(id: string, userId: string): Promise<boolean>;
  listAvailability(userId: string): Promise<AvailabilityRecord[]>;
  createAvailability(userId: string, input: CreateAvailabilityRequest): Promise<AvailabilityRecord>;
  updateAvailability(
    id: string,
    userId: string,
    input: UpdateAvailabilityRequest,
  ): Promise<AvailabilityRecord | null>;
  deleteAvailability(id: string, userId: string): Promise<boolean>;
  listCertifications(userId: string): Promise<CertificationRecord[]>;
  createCertification(
    userId: string,
    input: CreateCertificationRequest,
  ): Promise<CertificationRecord>;
  updateCertification(
    id: string,
    userId: string,
    input: UpdateCertificationRequest,
  ): Promise<CertificationRecord | null>;
  deleteCertification(id: string, userId: string): Promise<boolean>;
  listProjects(userId: string): Promise<ProjectRecord[]>;
  createProject(userId: string, input: CreateProjectRequest): Promise<ProjectRecord>;
  updateProject(
    id: string,
    userId: string,
    input: UpdateProjectRequest,
  ): Promise<ProjectRecord | null>;
  deleteProject(id: string, userId: string): Promise<boolean>;
}

export class DuplicateResourceError extends Error {
  constructor() {
    super('The resource already exists.');
    this.name = 'DuplicateResourceError';
  }
}

export type { CertificationStatus, DayOfWeek, LearningPriority, SkillProficiency };
