import { runNotificationTick } from "../src/lib/push-worker";
import { db } from "../src/lib/db";

let stopping = false;
let wake: (() => void) | undefined;
process.on("SIGTERM", () => {
  stopping = true;
  wake?.();
});
process.on("SIGINT", () => {
  stopping = true;
  wake?.();
});
async function main() {
  console.log(
    "BUZZ notification worker started. Inbox entries persist until acknowledged or resolved.",
  );
  while (!stopping) {
    try {
      await runNotificationTick();
    } catch {
      console.error(
        "Notification tick failed; pending jobs will retry. Check database connectivity and worker health in the inbox.",
      );
    }
    if (!stopping)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 10_000);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
  }
  await db.$disconnect();
}
main().catch(() => {
  process.exitCode = 1;
});
