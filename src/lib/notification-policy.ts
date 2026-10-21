export type NotificationPolicy = {
  intervalMinutes: number;
  // Reminders after the initial successful delivery; null continues until acknowledgment.
  maxReminders: number | null;
};
export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  intervalMinutes: 5,
  maxReminders: null,
};

export function reminderSummary(policy: NotificationPolicy, locale: string) {
  const { intervalMinutes: minutes, maxReminders: count } = policy;
  if (locale === "fa") {
    if (count === 0) return "فقط اعلان اول؛ بدون یادآوری تکراری.";
    return count === null
      ? `یادآوری هر ${minutes} دقیقه تا ثبت اطلاع مغازه ادامه دارد.`
      : `پس از اعلان اول، حداکثر ${count} یادآوری با فاصلهٔ ${minutes} دقیقه؛ تا ثبت اطلاع مغازه.`;
  }
  if (count === 0) return "Initial alert only; no repeated reminders.";
  return count === null
    ? `Reminders repeat every ${minutes} minutes until your shop acknowledges.`
    : `After the initial alert, up to ${count} reminders every ${minutes} minutes, until your shop acknowledges.`;
}

export function reminderDue(
  policy: NotificationPolicy,
  previous: { successes: number; lastSuccessAt: number | null },
  now: number,
) {
  return (
    (policy.maxReminders === null ||
      previous.successes < policy.maxReminders + 1) &&
    (previous.lastSuccessAt === null ||
      now - previous.lastSuccessAt >= policy.intervalMinutes * 60_000)
  );
}
