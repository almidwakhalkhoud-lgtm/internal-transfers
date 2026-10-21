import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(
  new URL("../../public/notifications-sw.js", import.meta.url),
  "utf8",
);
async function push(
  response: { ok: boolean; json?: () => Promise<unknown> } | Error,
  data = {
    id: "incoming-1",
    title: "Private transfer",
    body: "Full transfer text",
    url: "/notifications?notification=incoming-1",
    lang: "en",
  },
) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const show = vi.fn<
    (title: string, options: Record<string, unknown>) => Promise<void>
  >(async () => {});
  const self = {
    location: { origin: "https://example.test" },
    addEventListener: (type: string, handler: (e: unknown) => void) => {
      handlers[type] = handler;
    },
    registration: { showNotification: show },
    clients: { matchAll: async () => [] },
  };
  runInNewContext(source, {
    self,
    URL,
    fetch: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
  });
  let completion: Promise<unknown> | undefined;
  handlers.push({
    data: { json: () => data },
    waitUntil: (p: Promise<unknown>) => {
      completion = p;
    },
  });
  await completion;
  return show;
}
describe("background alerts survive expired sessions without exposing old account data", () => {
  it.each([new Error("Offline"), { ok: false }])(
    "shows a generic reminder when the authenticated inbox is unavailable",
    async (response) => {
      const show = await push(response);
      expect(show).toHaveBeenCalledOnce();
      expect(show.mock.calls[0]).not.toContain("Private transfer");
      expect(JSON.stringify(show.mock.calls[0])).toContain(
        "Open your notification inbox",
      );
    },
  );
  it("suppresses an already acknowledged transfer", async () => {
    const show = await push({
      ok: true,
      json: async () => ({
        items: [{ acknowledgedAt: new Date().toISOString() }],
      }),
    });
    expect(show).not.toHaveBeenCalled();
  });
  it("suppresses data when the signed-in user no longer has destination access", async () => {
    expect(
      await push({ ok: true, json: async () => ({ items: [] }) }),
    ).not.toHaveBeenCalled();
  });
  it("shows detailed text and a stable recurring tag for an authorized transfer", async () => {
    const show = await push({
      ok: true,
      json: async () => ({
        items: [
          {
            title: "Authorized transfer",
            acknowledgedAt: null,
            closedAt: null,
          },
        ],
      }),
    });
    expect(show).toHaveBeenCalledWith(
      "Authorized transfer",
      expect.objectContaining({
        body: "Full transfer text",
        tag: "transfer:incoming-1",
        renotify: true,
        requireInteraction: true,
      }),
    );
  });
});
