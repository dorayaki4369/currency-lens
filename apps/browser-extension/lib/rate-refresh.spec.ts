import { describe, expect, it, vi } from "vitest";
import {
  RATE_REFRESH_ALARM_NAME,
  RATE_REFRESH_PERIOD_MINUTES,
  ensureRateRefreshAlarm,
  type AlarmScheduler,
} from "./rate-refresh";

describe("ensureRateRefreshAlarm", () => {
  it("creates a missing periodic alarm", async () => {
    const alarms = createAlarmScheduler(undefined);
    await expect(ensureRateRefreshAlarm(alarms)).resolves.toBe(true);
    expect(alarms.create).toHaveBeenCalledWith(RATE_REFRESH_ALARM_NAME, {
      periodInMinutes: RATE_REFRESH_PERIOD_MINUTES,
    });
  });

  it("repairs an alarm with the wrong cadence", async () => {
    const alarms = createAlarmScheduler({ periodInMinutes: 5 });
    await expect(ensureRateRefreshAlarm(alarms)).resolves.toBe(true);
    expect(alarms.create).toHaveBeenCalledOnce();
  });

  it("leaves an existing correct alarm unchanged", async () => {
    const alarms = createAlarmScheduler({
      periodInMinutes: RATE_REFRESH_PERIOD_MINUTES,
    });
    await expect(ensureRateRefreshAlarm(alarms)).resolves.toBe(false);
    expect(alarms.create).not.toHaveBeenCalled();
  });
});

/** Creates a scheduler double with the same minimum capability used by production. */
function createAlarmScheduler(
  existing: { readonly periodInMinutes?: number } | undefined,
): AlarmScheduler & { create: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async () => existing),
    create: vi.fn(async () => undefined),
  };
}
