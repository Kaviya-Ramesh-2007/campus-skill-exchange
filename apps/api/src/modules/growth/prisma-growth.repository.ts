import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@campus-skill-exchange/database';
import type {
  CreateAvailabilityRequest,
  CreateCertificationRequest,
  CreateLearningGoalRequest,
  CreateProjectRequest,
  UpdateAvailabilityRequest,
  UpdateCertificationRequest,
  UpdateLearningGoalRequest,
  UpdateProjectRequest,
} from '@campus-skill-exchange/contracts';
import { PrismaService } from '../../platform/database/prisma.service';
import {
  DuplicateResourceError,
  type AvailabilityRecord,
  type CertificationRecord,
  type GrowthRepository,
  type LearningGoalRecord,
  type ProjectRecord,
} from './growth.types';

type GoalWithSkill = Prisma.LearningGoalGetPayload<{
  include: { skill: { select: { name: true } } };
}>;

@Injectable()
export class PrismaGrowthRepository implements GrowthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listLearningGoals(userId: string): Promise<LearningGoalRecord[]> {
    const rows = await this.prisma.learningGoal.findMany({
      where: { userId },
      include: { skill: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapGoal(row));
  }

  async createLearningGoal(
    userId: string,
    input: CreateLearningGoalRequest,
  ): Promise<LearningGoalRecord> {
    try {
      const row = await this.prisma.learningGoal.create({
        data: { id: randomUUID(), userId, ...input } as Prisma.LearningGoalUncheckedCreateInput,
        include: { skill: { select: { name: true } } },
      });
      return this.mapGoal(row);
    } catch (error) {
      if (this.isUnique(error)) throw new DuplicateResourceError();
      throw error;
    }
  }

  async updateLearningGoal(
    id: string,
    userId: string,
    input: UpdateLearningGoalRequest,
  ): Promise<LearningGoalRecord | null> {
    const existing = await this.prisma.learningGoal.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.learningGoal.update({
      where: { id },
      data: input as Prisma.LearningGoalUncheckedUpdateInput,
      include: { skill: { select: { name: true } } },
    });
    return this.mapGoal(row);
  }

  async deleteLearningGoal(id: string, userId: string): Promise<boolean> {
    return (await this.prisma.learningGoal.deleteMany({ where: { id, userId } })).count > 0;
  }

  async listAvailability(userId: string): Promise<AvailabilityRecord[]> {
    return this.prisma.availability.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createAvailability(
    userId: string,
    input: CreateAvailabilityRequest,
  ): Promise<AvailabilityRecord> {
    try {
      return await this.prisma.availability.create({
        data: { id: randomUUID(), userId, ...input },
      });
    } catch (error) {
      if (this.isUnique(error)) throw new DuplicateResourceError();
      throw error;
    }
  }

  async updateAvailability(
    id: string,
    userId: string,
    input: UpdateAvailabilityRequest,
  ): Promise<AvailabilityRecord | null> {
    const existing = await this.prisma.availability.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.prisma.availability.update({ where: { id }, data: input });
  }

  async deleteAvailability(id: string, userId: string): Promise<boolean> {
    return (await this.prisma.availability.deleteMany({ where: { id, userId } })).count > 0;
  }

  async listCertifications(userId: string): Promise<CertificationRecord[]> {
    return this.prisma.certification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCertification(
    userId: string,
    input: CreateCertificationRequest,
  ): Promise<CertificationRecord> {
    return this.prisma.certification.create({
      data: {
        id: randomUUID(),
        userId,
        ...input,
        issueDate: dateFromInput(input.issueDate),
        expiryDate: dateFromInput(input.expiryDate),
        status: 'PENDING',
      },
    });
  }

  async updateCertification(
    id: string,
    userId: string,
    input: UpdateCertificationRequest,
  ): Promise<CertificationRecord | null> {
    const existing = await this.prisma.certification.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.prisma.certification.update({
      where: { id },
      data: {
        ...input,
        ...(input.issueDate !== undefined ? { issueDate: dateFromInput(input.issueDate) } : {}),
        ...(input.expiryDate !== undefined ? { expiryDate: dateFromInput(input.expiryDate) } : {}),
      },
    });
  }

  async deleteCertification(id: string, userId: string): Promise<boolean> {
    return (await this.prisma.certification.deleteMany({ where: { id, userId } })).count > 0;
  }

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    return this.prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  async createProject(userId: string, input: CreateProjectRequest): Promise<ProjectRecord> {
    return this.prisma.project.create({
      data: {
        id: randomUUID(),
        userId,
        ...input,
        startDate: dateFromInput(input.startDate),
        endDate: dateFromInput(input.endDate),
      },
    });
  }

  async updateProject(
    id: string,
    userId: string,
    input: UpdateProjectRequest,
  ): Promise<ProjectRecord | null> {
    const existing = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...input,
        ...(input.startDate !== undefined ? { startDate: dateFromInput(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: dateFromInput(input.endDate) } : {}),
      },
    });
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    return (await this.prisma.project.deleteMany({ where: { id, userId } })).count > 0;
  }

  private mapGoal(row: GoalWithSkill): LearningGoalRecord {
    return { ...row, skillName: row.skill.name };
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}

function dateFromInput(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
