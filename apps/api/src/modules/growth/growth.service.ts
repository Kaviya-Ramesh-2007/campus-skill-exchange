import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  createAvailabilityRequestSchema,
  createCertificationRequestSchema,
  createLearningGoalRequestSchema,
  createProjectRequestSchema,
  updateAvailabilityRequestSchema,
  updateCertificationRequestSchema,
  updateLearningGoalRequestSchema,
  updateProjectRequestSchema,
  type Availability,
  type Certification,
  type LearningGoal,
  type Project,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  DuplicateResourceError,
  GROWTH_REPOSITORY,
  type AvailabilityRecord,
  type CertificationRecord,
  type GrowthRepository,
  type LearningGoalRecord,
  type ProjectRecord,
} from './growth.types';

@Injectable()
export class GrowthService {
  constructor(@Inject(GROWTH_REPOSITORY) private readonly repository: GrowthRepository) {}

  listLearningGoals(userId: string): Promise<LearningGoal[]> {
    return this.repository
      .listLearningGoals(userId)
      .then((rows) => rows.map((row) => this.goalResponse(row)));
  }

  createLearningGoal(userId: string, input: unknown): Promise<LearningGoal> {
    const data = this.parse(createLearningGoalRequestSchema, input);
    return this.create(
      () => this.repository.createLearningGoal(userId, data),
      (row) => this.goalResponse(row),
    );
  }

  async updateLearningGoal(id: string, userId: string, input: unknown): Promise<LearningGoal> {
    const data = this.parse(updateLearningGoalRequestSchema, input);
    const row = await this.repository.updateLearningGoal(id, userId, data);
    if (!row) this.notFound();
    return this.goalResponse(row);
  }

  async deleteLearningGoal(id: string, userId: string): Promise<void> {
    if (!(await this.repository.deleteLearningGoal(id, userId))) this.notFound();
  }

  listAvailability(userId: string): Promise<Availability[]> {
    return this.repository
      .listAvailability(userId)
      .then((rows) => rows.map((row) => this.availabilityResponse(row)));
  }

  createAvailability(userId: string, input: unknown): Promise<Availability> {
    const data = this.parse(createAvailabilityRequestSchema, input);
    return this.create(
      () => this.repository.createAvailability(userId, data),
      (row) => this.availabilityResponse(row),
    );
  }

  async updateAvailability(id: string, userId: string, input: unknown): Promise<Availability> {
    const data = this.parse(updateAvailabilityRequestSchema, input);
    const row = await this.repository.updateAvailability(id, userId, data);
    if (!row) this.notFound();
    return this.availabilityResponse(row);
  }

  async deleteAvailability(id: string, userId: string): Promise<void> {
    if (!(await this.repository.deleteAvailability(id, userId))) this.notFound();
  }

  listCertifications(userId: string): Promise<Certification[]> {
    return this.repository
      .listCertifications(userId)
      .then((rows) => rows.map((row) => this.certificationResponse(row)));
  }

  createCertification(userId: string, input: unknown): Promise<Certification> {
    const data = this.parse(createCertificationRequestSchema, input);
    return this.create(
      () => this.repository.createCertification(userId, data),
      (row) => this.certificationResponse(row),
    );
  }

  async updateCertification(id: string, userId: string, input: unknown): Promise<Certification> {
    const data = this.parse(updateCertificationRequestSchema, input);
    const row = await this.repository.updateCertification(id, userId, data);
    if (!row) this.notFound();
    return this.certificationResponse(row);
  }

  async deleteCertification(id: string, userId: string): Promise<void> {
    if (!(await this.repository.deleteCertification(id, userId))) this.notFound();
  }

  listProjects(userId: string): Promise<Project[]> {
    return this.repository
      .listProjects(userId)
      .then((rows) => rows.map((row) => this.projectResponse(row)));
  }

  createProject(userId: string, input: unknown): Promise<Project> {
    const data = this.parse(createProjectRequestSchema, input);
    return this.create(
      () => this.repository.createProject(userId, data),
      (row) => this.projectResponse(row),
    );
  }

  async updateProject(id: string, userId: string, input: unknown): Promise<Project> {
    const data = this.parse(updateProjectRequestSchema, input);
    const row = await this.repository.updateProject(id, userId, data);
    if (!row) this.notFound();
    return this.projectResponse(row);
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    if (!(await this.repository.deleteProject(id, userId))) this.notFound();
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success)
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    return result.data;
  }

  private async create<TRecord, TResponse>(
    operation: () => Promise<TRecord>,
    map: (row: TRecord) => TResponse,
  ): Promise<TResponse> {
    try {
      return map(await operation());
    } catch (error) {
      if (error instanceof DuplicateResourceError) {
        throw new ApiException(409, 'CONFLICT', 'The resource already exists.');
      }
      throw error;
    }
  }

  private notFound(): never {
    throw new ApiException(404, 'NOT_FOUND', 'The requested resource was not found.');
  }

  private goalResponse(row: LearningGoalRecord): LearningGoal {
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private availabilityResponse(row: AvailabilityRecord): Availability {
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private certificationResponse(row: CertificationRecord): Certification {
    return {
      ...row,
      issueDate: dateOnly(row.issueDate),
      expiryDate: dateOnly(row.expiryDate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private projectResponse(row: ProjectRecord): Project {
    return {
      ...row,
      startDate: dateOnly(row.startDate),
      endDate: dateOnly(row.endDate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}
