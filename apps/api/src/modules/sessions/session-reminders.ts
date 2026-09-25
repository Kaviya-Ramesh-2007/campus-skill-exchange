import {
  sessionReminder10mEventDefinition,
  sessionReminder1hEventDefinition,
  sessionReminder24hEventDefinition,
  type SessionReminderType,
} from '@campus-skill-exchange/contracts';

export const SESSION_REMINDER_TYPES: SessionReminderType[] = [
  'TWENTY_FOUR_HOURS',
  'ONE_HOUR',
  'TEN_MINUTES',
];

export const SESSION_REMINDER_OFFSET_MS: Record<SessionReminderType, number> = {
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
};

export function reminderTimesFor(scheduledStart: Date): Record<SessionReminderType, Date> {
  return {
    TWENTY_FOUR_HOURS: new Date(
      scheduledStart.getTime() - SESSION_REMINDER_OFFSET_MS.TWENTY_FOUR_HOURS,
    ),
    ONE_HOUR: new Date(scheduledStart.getTime() - SESSION_REMINDER_OFFSET_MS.ONE_HOUR),
    TEN_MINUTES: new Date(scheduledStart.getTime() - SESSION_REMINDER_OFFSET_MS.TEN_MINUTES),
  };
}

export function reminderDefinition(type: SessionReminderType) {
  if (type === 'TWENTY_FOUR_HOURS') return sessionReminder24hEventDefinition;
  if (type === 'ONE_HOUR') return sessionReminder1hEventDefinition;
  return sessionReminder10mEventDefinition;
}
