export const RATE_REFRESH_ALARM_NAME = "refresh-exchange-rates";
export const RATE_REFRESH_PERIOD_MINUTES = 60;

export interface AlarmRecord {
  readonly periodInMinutes?: number;
}

export interface AlarmScheduler {
  get(name: string): Promise<AlarmRecord | undefined>;
  create(
    name: string,
    alarmInfo: { readonly periodInMinutes: number },
  ): Promise<void> | void;
}

/** Ensures the periodic refresh alarm exists with the expected cadence. */
export async function ensureRateRefreshAlarm(alarms: AlarmScheduler): Promise<boolean> {
  const existing = await alarms.get(RATE_REFRESH_ALARM_NAME);
  if (existing?.periodInMinutes === RATE_REFRESH_PERIOD_MINUTES) {
    return false;
  }

  await alarms.create(RATE_REFRESH_ALARM_NAME, {
    periodInMinutes: RATE_REFRESH_PERIOD_MINUTES,
  });
  return true;
}
