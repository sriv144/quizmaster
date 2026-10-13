import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { MediaService } from "./media.service.js";

describe("media configuration", () => {
  it("lets the demo start without storage credentials and rejects uploads explicitly", async () => {
    const media = new MediaService(new ConfigService({}), {} as PrismaService);
    await expect(media.intent({ fileName: "photo.png", mimeType: "image/png", sizeBytes: 100 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(media.finalize({ objectKey: "questions/test.png", mimeType: "image/png", sizeBytes: 100 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
