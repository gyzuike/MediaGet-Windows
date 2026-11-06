import { afterEach, describe, expect, it } from "vitest";
import { parseYoutube } from "../packages/parse-core/src/lib/youtube";
import { parseTiktok } from "../packages/parse-core/src/lib/tiktokDlp";
import { parseInstagram } from "../packages/parse-core/src/lib/instagram";
const scope = globalThis as typeof globalThis & { __mediagetDesktopParsers?: Record<string, (url: string) => Promise<unknown>> };
afterEach(() => { delete scope.__mediagetDesktopParsers; });
describe("Windows desktop parser bridge", () => {
  for (const [name, parser, url] of [
    ["youtube", parseYoutube, "https://www.youtube.com/watch?v=jNQXAC9IVRw"],
    ["tiktok", parseTiktok, "https://www.tiktok.com/@example/video/1234567890123456789"],
    ["instagram", parseInstagram, "https://www.instagram.com/reel/example/"]
  ] as const) {
    it(`delegates ${name} through the runtime bridge without compiled file patches`, async () => {
      let received = "";
      const result = { code: 200, msg: "ok", data: { type: "video", url: "https://media.example/test.mp4" } };
      scope.__mediagetDesktopParsers = { [name]: async value => { received = value; return result; } };
      expect(await parser(url)).toBe(result);
      expect(received).toBe(url);
    });
  }
});
