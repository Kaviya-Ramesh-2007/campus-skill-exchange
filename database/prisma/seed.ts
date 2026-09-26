/**
 * Presentation demo data for Campus Skill Exchange.
 *
 * Design goals
 * - Idempotent: every write is an upsert keyed on an existing unique constraint.
 * - Scoped: only rows owned by the deterministic demo email prefix are touched.
 * - Honest: no Google Meet links, no Razorpay payments, no ratings/assessments.
 *   Those are produced by real user flows and are deliberately not faked here.
 *
 * Run with `npm run demo:seed` (requires DEMO_SEED=true).
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The Prisma CLI loads .env itself, but the runtime client does not, so the
// repository-root .env is loaded explicitly before the client is constructed.
for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const prisma = new PrismaClient();

/** Only rows with this email prefix are ever created or deleted. */
const DEMO_EMAIL_PREFIX = 'demo.';
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

function assertSafeToRun(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production.');
  }
  if (process.env.DEMO_SEED !== 'true') {
    throw new Error('Refusing to run: set DEMO_SEED=true to allow demo data.');
  }
}

/**
 * Deterministic, RFC-4122-shaped v4 UUID derived from a stable namespace.
 *
 * It must be stable across runs: rows are upserted on natural keys
 * (Skill.normalizedName, BadgeDefinition.code), so the `create` branch only
 * fires the first time. If the generated id changed between runs, a re-seed
 * would reference a Skill that already exists under a different id and violate
 * the foreign key.
 */
function deterministicUuid(namespace: string): string {
  const hash = createHash('sha1').update(namespace).digest('hex');
  const variant = '89ab'[parseInt(hash[16] ?? '0', 16) % 4];
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variant}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

const SKILLS = [
  { key: 'java', name: 'Java' },
  { key: 'python', name: 'Python' },
  { key: 'javascript', name: 'JavaScript' },
  { key: 'react', name: 'React' },
  { key: 'aws', name: 'AWS' },
  { key: 'sql', name: 'SQL' },
  { key: 'uiux', name: 'UI/UX' },
  { key: 'ml', name: 'Machine Learning' },
  { key: 'cloud', name: 'Cloud Computing' },
  { key: 'dbms', name: 'DBMS' },
];
const newSkillId = (key: string) => deterministicUuid('cse-demo:skill:' + key);

interface DemoUserSpec {
  key: string;
  email: string;
  displayName: string;
  roles: ('USER' | 'ADMIN')[];
  profile: {
    department: string;
    academicYear: string;
    institution: string;
    bio: string;
    interests: string[];
    githubUrl?: string;
  };
  teaches: { skill: string; proficiency: 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' }[];
  wants: { skill: string; target: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }[];
  availability: { day: string; start: string; end: string }[];
  certifications?: { title: string; org: string; status: 'PENDING' | 'VERIFIED' }[];
  projects?: { title: string; description: string; technologies: string[] }[];
  badges?: string[];
}

/**
 * Matching is deliberately legible:
 *   Kaviya  teaches Java/JavaScript, wants AWS/SQL
 *   Arun    teaches AWS/Cloud,     wants Java/React
 *   Priya   teaches React/UI/UX,   wants Python/ML/DBMS
 *   Rahul   teaches Python/ML,     wants React/SQL/AWS
 *   Ananya  teaches SQL/DBMS,      wants JavaScript/Cloud
 * => mutual pairs: Kaviya<->Arun, Kaviya<->Ananya, Priya<->Rahul.
 */
const USERS: DemoUserSpec[] = [
  {
    key: 'kaviya',
    email: 'demo.kaviya@example.test',
    displayName: 'Kaviya Raman',
    roles: ['USER'],
    profile: {
      department: 'Computer Science',
      academicYear: 'Third year',
      institution: 'Example Institute of Technology',
      bio: 'Backend developer who enjoys making systems simple and fast. Happy to help with Java and web fundamentals.',
      interests: ['Java', 'JavaScript', 'System design'],
      githubUrl: 'https://github.com/example-kaviya',
    },
    teaches: [
      { skill: 'java', proficiency: 'ADVANCED' },
      { skill: 'javascript', proficiency: 'INTERMEDIATE' },
    ],
    wants: [
      { skill: 'aws', target: 'INTERMEDIATE' },
      { skill: 'sql', target: 'INTERMEDIATE' },
    ],
    availability: [
      { day: 'MONDAY', start: '18:00', end: '20:00' },
      { day: 'WEDNESDAY', start: '18:00', end: '20:00' },
    ],
    certifications: [
      {
        title: 'Oracle Java SE Programming',
        org: 'Example Certification Board',
        status: 'VERIFIED',
      },
    ],
    projects: [
      {
        title: 'Library management console',
        description: 'A Java console application for tracking book loans and returns.',
        technologies: ['Java', 'PostgreSQL'],
      },
    ],
    badges: ['first_exchange', 'helpful_peer'],
  },
  {
    key: 'arun',
    email: 'demo.arun@example.test',
    displayName: 'Arun Desai',
    roles: ['USER'],
    profile: {
      department: 'Information Technology',
      academicYear: 'Final year',
      institution: 'Example Institute of Technology',
      bio: 'Cloud enthusiast who has built small deployments on AWS. Learning the frontend to build end-to-end products.',
      interests: ['AWS', 'Cloud', 'React'],
      githubUrl: 'https://github.com/example-arun',
    },
    teaches: [
      { skill: 'aws', proficiency: 'ADVANCED' },
      { skill: 'cloud', proficiency: 'INTERMEDIATE' },
    ],
    wants: [
      { skill: 'java', target: 'INTERMEDIATE' },
      { skill: 'react', target: 'INTERMEDIATE' },
    ],
    availability: [
      { day: 'TUESDAY', start: '17:00', end: '19:00' },
      { day: 'SATURDAY', start: '10:00', end: '12:00' },
    ],
    certifications: [
      {
        title: 'AWS Certified Cloud Practitioner',
        org: 'Example Cloud Institute',
        status: 'VERIFIED',
      },
    ],
    projects: [
      {
        title: 'Static site deployment pipeline',
        description: 'A CI pipeline that builds and publishes a static site to object storage.',
        technologies: ['AWS', 'JavaScript'],
      },
    ],
    badges: ['first_exchange'],
  },
  {
    key: 'priya',
    email: 'demo.priya@example.test',
    displayName: 'Priya Nair',
    roles: ['USER'],
    profile: {
      department: 'Design',
      academicYear: 'Second year',
      institution: 'Example Institute of Design',
      bio: 'Product designer focused on accessible interfaces. I can teach design systems and React fundamentals.',
      interests: ['UI/UX', 'React', 'Accessibility'],
      githubUrl: 'https://github.com/example-priya',
    },
    teaches: [
      { skill: 'react', proficiency: 'ADVANCED' },
      { skill: 'uiux', proficiency: 'EXPERT' },
    ],
    wants: [
      { skill: 'python', target: 'INTERMEDIATE' },
      { skill: 'ml', target: 'BEGINNER' },
      { skill: 'dbms', target: 'INTERMEDIATE' },
    ],
    availability: [
      { day: 'WEDNESDAY', start: '16:00', end: '18:00' },
      { day: 'FRIDAY', start: '16:00', end: '18:00' },
    ],
    projects: [
      {
        title: 'Campus design system',
        description: 'A reusable component library with accessibility checks built in.',
        technologies: ['React', 'UI/UX'],
      },
    ],
    badges: ['helpful_peer'],
  },
  {
    key: 'rahul',
    email: 'demo.rahul@example.test',
    displayName: 'Rahul Iyer',
    roles: ['USER'],
    profile: {
      department: 'Computer Science',
      academicYear: 'Third year',
      institution: 'Example Institute of Technology',
      bio: 'Machine learning student. I use Python daily and enjoy explaining the intuition behind models.',
      interests: ['Machine Learning', 'Python', 'Data'],
      githubUrl: 'https://github.com/example-rahul',
    },
    teaches: [
      { skill: 'python', proficiency: 'EXPERT' },
      { skill: 'ml', proficiency: 'ADVANCED' },
    ],
    wants: [
      { skill: 'react', target: 'INTERMEDIATE' },
      { skill: 'sql', target: 'INTERMEDIATE' },
      { skill: 'aws', target: 'BEGINNER' },
    ],
    availability: [
      { day: 'TUESDAY', start: '19:00', end: '21:00' },
      { day: 'THURSDAY', start: '19:00', end: '21:00' },
    ],
    certifications: [
      { title: 'Python for Data Science', org: 'Example Data Academy', status: 'VERIFIED' },
      { title: 'Foundations of Machine Learning', org: 'Example Data Academy', status: 'PENDING' },
    ],
    projects: [
      {
        title: 'Attendance anomaly detector',
        description:
          'A Python script that flags unusual attendance patterns using simple statistics.',
        technologies: ['Python', 'Machine Learning'],
      },
    ],
    badges: ['first_exchange', 'helpful_peer'],
  },
  {
    key: 'ananya',
    email: 'demo.ananya@example.test',
    displayName: 'Ananya Gupta',
    roles: ['USER'],
    profile: {
      department: 'Computer Science',
      academicYear: 'Final year',
      institution: 'Example Institute of Technology',
      bio: 'Database enthusiast. I can help with SQL and data modelling, and I am learning the frontend.',
      interests: ['SQL', 'DBMS', 'JavaScript'],
      githubUrl: 'https://github.com/example-ananya',
    },
    teaches: [
      { skill: 'sql', proficiency: 'EXPERT' },
      { skill: 'dbms', proficiency: 'ADVANCED' },
    ],
    wants: [
      { skill: 'javascript', target: 'INTERMEDIATE' },
      { skill: 'cloud', target: 'INTERMEDIATE' },
    ],
    availability: [
      { day: 'MONDAY', start: '17:00', end: '19:00' },
      { day: 'THURSDAY', start: '17:00', end: '19:00' },
    ],
    certifications: [
      { title: 'SQL Fundamentals', org: 'Example Data Academy', status: 'VERIFIED' },
    ],
    projects: [
      {
        title: 'Library schema redesign',
        description: 'A normalised schema and query set for a university library database.',
        technologies: ['SQL', 'DBMS'],
      },
    ],
    badges: [],
  },
  {
    key: 'admin',
    email: 'demo.admin@example.test',
    displayName: 'Demo Administrator',
    roles: ['USER', 'ADMIN'],
    profile: {
      department: 'Student Affairs',
      academicYear: 'Staff',
      institution: 'Example Institute of Technology',
      bio: 'Demonstration administrator account used to show the admin control centre and safety reports.',
      interests: ['Community', 'Safety'],
    },
    teaches: [],
    wants: [],
    availability: [],
    projects: [],
    badges: [],
  },
];

const BADGES = [
  {
    key: 'first_exchange',
    code: 'FIRST_EXCHANGE',
    name: 'First exchange',
    description: 'Completed a first skill-exchange session.',
  },
  {
    key: 'helpful_peer',
    code: 'HELPFUL_PEER',
    name: 'Helpful peer',
    description: 'Helped another User learn a new skill.',
  },
  {
    key: 'reliable',
    code: 'RELIABLE_PEER',
    name: 'Reliable peer',
    description: 'Attended and prepared for multiple agreed sessions.',
  },
  {
    key: 'well_rounded',
    code: 'WELL_ROUNDED',
    name: 'Well rounded',
    description: 'Shared expertise across three different skills.',
  },
];

const userId = (key: string) => deterministicUuid('cse-demo:user:' + key);
const newBadgeId = (key: string) => deterministicUuid('cse-demo:badge:' + key);

async function seed(): Promise<void> {
  assertSafeToRun();
  // 16+ characters, satisfying the existing registration minimum of 12.
  const password = process.env.DEMO_PASSWORD ?? 'DemoExchange2026!';
  if (password.length < 12) {
    throw new Error('DEMO_PASSWORD must be at least 12 characters.');
  }
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  const now = new Date();

  // The id returned by the upsert is the authoritative one: on a re-seed the
  // row already exists, so `create` is skipped and the stored id wins.
  const resolvedSkillIds = new Map<string, string>();
  for (const skill of SKILLS) {
    const row = await prisma.skill.upsert({
      where: { normalizedName: skill.name.toLowerCase() },
      update: { name: skill.name },
      create: {
        id: newSkillId(skill.key),
        name: skill.name,
        normalizedName: skill.name.toLowerCase(),
      },
    });
    resolvedSkillIds.set(skill.key, row.id);
  }
  const skillId = (key: string): string => {
    const resolved = resolvedSkillIds.get(key);
    if (!resolved) throw new Error(`Unknown demo skill: ${key}`);
    return resolved;
  };

  const resolvedBadgeIds = new Map<string, string>();
  for (const badge of BADGES) {
    const row = await prisma.badgeDefinition.upsert({
      where: { code: badge.code },
      update: { name: badge.name, description: badge.description },
      create: {
        id: newBadgeId(badge.key),
        code: badge.code,
        name: badge.name,
        description: badge.description,
      },
    });
    resolvedBadgeIds.set(badge.key, row.id);
  }
  const badgeId = (key: string): string => {
    const resolved = resolvedBadgeIds.get(key);
    if (!resolved) throw new Error(`Unknown demo badge: ${key}`);
    return resolved;
  };

  for (const user of USERS) {
    const uid = userId(user.key);
    const isNew = !(await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    }));
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { displayName: user.displayName },
      create: {
        id: uid,
        email: user.email,
        displayName: user.displayName,
        accountStatus: 'ACTIVE',
      },
    });
    const finalId = created.id;

    for (const role of user.roles) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: finalId, role } },
        update: {},
        create: { userId: finalId, role },
      });
    }

    // Only seed a credential for a brand-new account, so a rotated demo
    // password is never silently overwritten on a later run.
    if (isNew) {
      await prisma.passwordCredential.upsert({
        where: { userId: finalId },
        update: {},
        create: { id: randomUUID(), userId: finalId, passwordHash },
      });
    }

    await prisma.profile.upsert({
      where: { userId: finalId },
      update: {
        publicDisplayName: user.displayName,
        department: user.profile.department,
        academicYear: user.profile.academicYear,
        institution: user.profile.institution,
        bio: user.profile.bio,
        interests: user.profile.interests,
        githubUrl: user.profile.githubUrl ?? null,
        visibility: 'PUBLIC',
      },
      create: {
        id: deterministicUuid('cse-demo:profile:' + user.key),
        userId: finalId,
        publicDisplayName: user.displayName,
        department: user.profile.department,
        academicYear: user.profile.academicYear,
        institution: user.profile.institution,
        bio: user.profile.bio,
        interests: user.profile.interests,
        githubUrl: user.profile.githubUrl ?? null,
        visibility: 'PUBLIC',
      },
    });

    for (const teach of user.teaches) {
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: finalId, skillId: skillId(teach.skill) } },
        update: { canTeach: true, proficiency: teach.proficiency },
        create: {
          id: randomUUID(),
          userId: finalId,
          skillId: skillId(teach.skill),
          canTeach: true,
          proficiency: teach.proficiency,
        },
      });
    }

    for (const want of user.wants) {
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: finalId, skillId: skillId(want.skill) } },
        update: {},
        create: {
          id: randomUUID(),
          userId: finalId,
          skillId: skillId(want.skill),
          canTeach: false,
          proficiency: 'BEGINNER',
        },
      });
    }

    for (const goal of user.wants) {
      await prisma.learningGoal.upsert({
        where: { userId_skillId: { userId: finalId, skillId: skillId(goal.skill) } },
        update: { targetLevel: goal.target },
        create: {
          id: randomUUID(),
          userId: finalId,
          skillId: skillId(goal.skill),
          currentLevel: 'BEGINNER',
          targetLevel: goal.target,
          priority: 'MEDIUM',
        },
      });
    }

    for (const slot of user.availability) {
      await prisma.availability.upsert({
        where: {
          userId_dayOfWeek_startTime_endTime_timezone: {
            userId: finalId,
            dayOfWeek: slot.day as never,
            startTime: slot.start,
            endTime: slot.end,
            timezone: 'Asia/Kolkata',
          },
        },
        update: { isActive: true },
        create: {
          id: randomUUID(),
          userId: finalId,
          dayOfWeek: slot.day as never,
          startTime: slot.start,
          endTime: slot.end,
          timezone: 'Asia/Kolkata',
          isActive: true,
        },
      });
    }

    for (const cert of user.certifications ?? []) {
      const existing = await prisma.certification.findFirst({
        where: { userId: finalId, title: cert.title },
        select: { id: true },
      });
      if (!existing) {
        await prisma.certification.create({
          data: {
            id: randomUUID(),
            userId: finalId,
            title: cert.title,
            issuingOrganization: cert.org,
            status: cert.status,
          },
        });
      }
    }

    for (const project of user.projects ?? []) {
      const existing = await prisma.project.findFirst({
        where: { userId: finalId, title: project.title },
        select: { id: true },
      });
      if (!existing) {
        await prisma.project.create({
          data: {
            id: randomUUID(),
            userId: finalId,
            title: project.title,
            description: project.description,
            technologies: project.technologies,
          },
        });
      }
    }

    for (const badgeKey of user.badges ?? []) {
      await prisma.userBadge.upsert({
        where: {
          userId_badgeDefinitionId: {
            userId: finalId,
            badgeDefinitionId: badgeId(badgeKey),
          },
        },
        update: {},
        create: { id: randomUUID(), userId: finalId, badgeDefinitionId: badgeId(badgeKey) },
      });
    }
  }

  void now;
  const counts = await Promise.all([
    prisma.user.count({ where: { email: { startsWith: DEMO_EMAIL_PREFIX } } }),
    prisma.skill.count(),
    prisma.profile.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.userSkill.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.learningGoal.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.availability.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.certification.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.project.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
    prisma.badgeDefinition.count(),
    prisma.userBadge.count({ where: { user: { email: { startsWith: DEMO_EMAIL_PREFIX } } } }),
  ]);
  console.log(
    [
      'Demo seed complete.',
      `  demo users:        ${counts[0]}`,
      `  skills:            ${counts[1]}`,
      `  profiles:          ${counts[2]}`,
      `  user skills:       ${counts[3]}`,
      `  learning goals:    ${counts[4]}`,
      `  availability:      ${counts[5]}`,
      `  certifications:    ${counts[6]}`,
      `  projects:          ${counts[7]}`,
      `  badge definitions: ${counts[8]}`,
      `  user badges:       ${counts[9]}`,
    ].join('\n'),
  );
}

async function reset(): Promise<void> {
  assertSafeToRun();

  // Strictly scoped: only the deterministic demo email prefix is ever matched.
  const demoUsers = await prisma.user.findMany({
    where: { email: { startsWith: DEMO_EMAIL_PREFIX } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((user) => user.id);
  if (demoUserIds.length === 0) {
    console.log('No demo users found; nothing to reset.');
    return;
  }

  // UserBadge is a Restrict relation to BadgeDefinition, so award rows are
  // removed first; everything else cascades from the User.
  const badgesRemoved = await prisma.userBadge.deleteMany({
    where: { userId: { in: demoUserIds } },
  });
  const demoEmails = await prisma.user.findMany({
    where: { id: { in: demoUserIds } },
    select: { email: true },
  });
  const removed = await prisma.user.deleteMany({
    where: { id: { in: demoUserIds }, email: { startsWith: DEMO_EMAIL_PREFIX } },
  });

  console.log(
    [
      'Demo reset complete.',
      `  users deleted:        ${removed.count} (${demoEmails.map((u) => u.email).join(', ')})`,
      `  badge awards removed: ${badgesRemoved.count}`,
      '  badge definitions were kept (shared lookup data).',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'seed';
  try {
    if (command === 'reset') {
      await reset();
    } else {
      await seed();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
