import type {
  Availability,
  Certification,
  CreateAvailabilityRequest,
  CreateCertificationRequest,
  CreateLearningGoalRequest,
  CreateProjectRequest,
  LearningGoal,
  Project,
} from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export const listLearningGoals = () => apiRequest<LearningGoal[]>('/learning-goals');
export const createLearningGoal = (input: CreateLearningGoalRequest) =>
  apiRequest<LearningGoal>('/learning-goals', { method: 'POST', body: input });
export const listAvailability = () => apiRequest<Availability[]>('/availability');
export const createAvailability = (input: CreateAvailabilityRequest) =>
  apiRequest<Availability>('/availability', { method: 'POST', body: input });
export const listCertifications = () => apiRequest<Certification[]>('/certifications');
export const createCertification = (input: CreateCertificationRequest) =>
  apiRequest<Certification>('/certifications', { method: 'POST', body: input });
export const listProjects = () => apiRequest<Project[]>('/projects');
export const createProject = (input: CreateProjectRequest) =>
  apiRequest<Project>('/projects', { method: 'POST', body: input });
