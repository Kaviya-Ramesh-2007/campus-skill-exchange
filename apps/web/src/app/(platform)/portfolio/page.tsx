'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Loading } from '@campus-skill-exchange/ui';
import type {
  Availability,
  Certification,
  LearningGoal,
  Project,
  SkillProficiency,
  LearningPriority,
  DayOfWeek,
} from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import {
  createAvailability,
  createCertification,
  createLearningGoal,
  createProject,
  listAvailability,
  listCertifications,
  listLearningGoals,
  listProjects,
} from '../../../features/growth/growth-api';
import { ApiClientError } from '../../../services/api-client';

export default function PortfolioPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState({
    goals: [] as LearningGoal[],
    availability: [] as Availability[],
    certifications: [] as Certification[],
    projects: [] as Project[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [goals, availability, certifications, projects] = await Promise.all([
        listLearningGoals(),
        listAvailability(),
        listCertifications(),
        listProjects(),
      ]);
      setData({ goals, availability, certifications, projects });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load your portfolio.',
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Keep the portfolio synchronized with the authenticated session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(operation: () => Promise<void>, message: string) {
    setError(null);
    setSuccess(null);
    try {
      await operation();
      setSuccess(message);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : 'The change could not be saved.',
      );
    }
  }

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) return <SignInRequired />;
  if (loading) return <Loading label="Loading your portfolio" />;

  return (
    <div className="content-stack portfolio-page">
      <div className="page-heading">
        <p className="eyebrow">Your development</p>
        <h1>Goals, availability & portfolio</h1>
        <p>Keep your learning context and portfolio ready for future connections.</p>
      </div>
      {error && (
        <Alert severity="error" title="Unable to save changes">
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" title="Saved">
          {success}
        </Alert>
      )}

      <LearningGoalSection
        goals={data.goals}
        onCreate={(input) =>
          run(async () => {
            const created = await createLearningGoal(input);
            setData((current) => ({ ...current, goals: [created, ...current.goals] }));
          }, 'Learning goal saved.')
        }
      />
      <AvailabilitySection
        slots={data.availability}
        onCreate={(input) =>
          run(async () => {
            const created = await createAvailability(input);
            setData((current) => ({
              ...current,
              availability: [...current.availability, created],
            }));
          }, 'Availability saved.')
        }
      />
      <CertificationSection
        certifications={data.certifications}
        onCreate={(input) =>
          run(async () => {
            const created = await createCertification(input);
            setData((current) => ({
              ...current,
              certifications: [created, ...current.certifications],
            }));
          }, 'Certification submitted for review.')
        }
      />
      <ProjectSection
        projects={data.projects}
        onCreate={(input) =>
          run(async () => {
            const created = await createProject(input);
            setData((current) => ({ ...current, projects: [created, ...current.projects] }));
          }, 'Project saved.')
        }
      />
    </div>
  );
}

function LearningGoalSection({
  goals,
  onCreate,
}: {
  goals: LearningGoal[];
  onCreate: (input: Parameters<typeof createLearningGoal>[0]) => Promise<void>;
}) {
  const [skillId, setSkillId] = useState('');
  const [currentLevel, setCurrentLevel] = useState<SkillProficiency>('BEGINNER');
  const [targetLevel, setTargetLevel] = useState<SkillProficiency>('INTERMEDIATE');
  const [priority, setPriority] = useState<LearningPriority>('MEDIUM');
  return (
    <Card title="Learning goals">
      {goals.length === 0 ? (
        <p className="portfolio-empty">No learning goals yet.</p>
      ) : (
        <ul className="portfolio-list">
          {goals.map((goal) => (
            <li key={goal.id}>
              {goal.skillName}: {goal.currentLevel} → {goal.targetLevel}
            </li>
          ))}
        </ul>
      )}
      <form
        className="portfolio-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({ skillId, currentLevel, targetLevel, priority });
        }}
      >
        <Input
          id="goal-skill-id"
          label="Skill ID"
          required
          value={skillId}
          onChange={(event) => setSkillId(event.target.value)}
        />
        <div className="portfolio-form__row">
          <Select
            id="goal-current"
            label="Current level"
            value={currentLevel}
            options={['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']}
            onChange={(value) => setCurrentLevel(value as SkillProficiency)}
          />
          <Select
            id="goal-target"
            label="Target level"
            value={targetLevel}
            options={['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']}
            onChange={(value) => setTargetLevel(value as SkillProficiency)}
          />
          <Select
            id="goal-priority"
            label="Priority"
            value={priority}
            options={['LOW', 'MEDIUM', 'HIGH']}
            onChange={(value) => setPriority(value as LearningPriority)}
          />
        </div>
        <Button type="submit">Add learning goal</Button>
      </form>
    </Card>
  );
}

function AvailabilitySection({
  slots,
  onCreate,
}: {
  slots: Availability[];
  onCreate: (input: Parameters<typeof createAvailability>[0]) => Promise<void>;
}) {
  const [dayOfWeek, setDay] = useState<DayOfWeek>('MONDAY');
  const [startTime, setStart] = useState('18:00');
  const [endTime, setEnd] = useState('20:00');
  return (
    <Card title="Weekly availability">
      {slots.length === 0 ? (
        <p className="portfolio-empty">No availability added.</p>
      ) : (
        <ul className="portfolio-list">
          {slots.map((slot) => (
            <li key={slot.id}>
              {slot.dayOfWeek} {slot.startTime}–{slot.endTime} ({slot.timezone})
            </li>
          ))}
        </ul>
      )}
      <form
        className="portfolio-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({ dayOfWeek, startTime, endTime, timezone: 'UTC', isActive: true });
        }}
      >
        <div className="portfolio-form__row">
          <Select
            id="availability-day"
            label="Day"
            value={dayOfWeek}
            options={['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']}
            onChange={(value) => setDay(value as DayOfWeek)}
          />
          <Input
            id="availability-start"
            label="Start"
            type="time"
            required
            value={startTime}
            onChange={(event) => setStart(event.target.value)}
          />
          <Input
            id="availability-end"
            label="End"
            type="time"
            required
            value={endTime}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        <Button type="submit">Add availability</Button>
      </form>
    </Card>
  );
}

function CertificationSection({
  certifications,
  onCreate,
}: {
  certifications: Certification[];
  onCreate: (input: Parameters<typeof createCertification>[0]) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  return (
    <Card title="Certifications">
      {certifications.length === 0 ? (
        <p className="portfolio-empty">No certifications submitted.</p>
      ) : (
        <ul className="portfolio-list">
          {certifications.map((item) => (
            <li key={item.id}>
              {item.title} · {item.status}
            </li>
          ))}
        </ul>
      )}
      <form
        className="portfolio-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({
            title,
            issuingOrganization: organization,
            issueDate: issueDate || null,
            expiryDate: expiryDate || null,
          });
        }}
      >
        <div className="portfolio-form__row">
          <Input
            id="cert-title"
            label="Title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            id="cert-org"
            label="Issuing organization"
            required
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </div>
        <div className="portfolio-form__row">
          <Input
            id="cert-issue"
            label="Issue date"
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
          <Input
            id="cert-expiry"
            label="Expiry date"
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
        </div>
        <Button type="submit">Submit certification</Button>
      </form>
    </Card>
  );
}

function ProjectSection({
  projects,
  onCreate,
}: {
  projects: Project[];
  onCreate: (input: Parameters<typeof createProject>[0]) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  return (
    <Card title="Projects / portfolio">
      {projects.length === 0 ? (
        <p className="portfolio-empty">No projects added.</p>
      ) : (
        <ul className="portfolio-list">
          {projects.map((project) => (
            <li key={project.id}>{project.title}</li>
          ))}
        </ul>
      )}
      <form
        className="portfolio-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({
            title,
            description,
            technologies: [],
            projectUrl: projectUrl || null,
            repositoryUrl: repositoryUrl || null,
          });
        }}
      >
        <Input
          id="project-title"
          label="Project title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="portfolio-field" htmlFor="project-description">
          <span>Description</span>
          <textarea
            id="project-description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="portfolio-form__row">
          <Input
            id="project-url"
            label="Project URL"
            type="url"
            value={projectUrl}
            onChange={(event) => setProjectUrl(event.target.value)}
          />
          <Input
            id="repo-url"
            label="Repository URL"
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
          />
        </div>
        <Button type="submit">Add project</Button>
      </form>
    </Card>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="portfolio-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SignInRequired() {
  return (
    <div className="content-stack">
      <Alert severity="info" title="Sign in required">
        Sign in to manage your goals, availability, certifications, and projects.
      </Alert>
      <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
        Sign in
      </Link>
    </div>
  );
}
