import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(
  new URL("../../public/notifications-sw.js", import.meta.url),
  "utf8",
);
function worker() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const show = vi.fn<
    (title: string, options: Record<string, unknown>) => Promise<void>
  >(async () => {});
  const fetch = vi.fn(async () => ({ ok: true }));
  const self = {
    location: { origin: "https://example.test" },
    addEventListener: (type: string, handler: (e: unknown) => void) => {
      handlers[type] = handler;
    },
    registration: { showNotification: show },
    clients: { matchAll: async () => [] },
  };
  runInNewContext(source, { self, URL, fetch });
  const dispatch = async (type: string, event: object) => {
    let completion: Promise<unknown> | undefined;
    handlers[type]({
      ...event,
      waitUntil: (p: Promise<unknown>) => {
        completion = p;
      },
    });
    await completion;
  };
  return { show, fetch, dispatch };
}
const push = async (data: unknown) => {
  const w = worker();
  await w.dispatch("push", { data: { json: () => data } });
  return w;
};
describe("every push shows a readable notification at once", () => {
  it("shows the transfer alert without asking the server first", async () => {
    const { show, fetch } = await push({
      id: "incoming-1",
      title: "ترانسفر ورودی MA-0001",
      body: "از Main به Al Azaiba",
      url: "/notifications?notification=incoming-1",
      lang: "fa",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(
      "ترانسفر ورودی MA-0001",
      expect.objectContaining({
        body: "از Main به Al Azaiba",
        dir: "rtl",
        lang: "fa",
        tag: "transfer:incoming-1",
        renotify: true,
        data: { url: "/notifications?notification=incoming-1" },
      }),
    );
  });
  it("still shows something for an empty or broken push", async () => {
    const { show } = await push(undefined);
    expect(show).toHaveBeenCalledOnce();
    expect(show.mock.calls[0][0]).toContain("BUZZ");
  });
  it("never sends a click to another site", async () => {
    const { show } = await push({
      title: "x",
      url: "https://evil.example/steal",
      lang: "en",
    });
    expect(show.mock.calls[0][1]).toMatchObject({
      data: { url: "/notifications" },
    });
  });
  it("registers a replaced subscription with the server", async () => {
    const w = worker();
    const subscription = { toJSON: () => ({ endpoint: "https://push/1" }) };
    await w.dispatch("pushsubscriptionchange", {
      newSubscription: subscription,
    });
    expect(w.fetch).toHaveBeenCalledWith(
      "/api/notifications/push",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
