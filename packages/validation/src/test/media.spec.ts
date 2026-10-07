import { describe, expect, it } from "vitest";

import { externalBackgroundVideoType, mediaUploadSchema } from "../media";

const input = (type: string, purpose = "image", size = 1) => {
  const data = new FormData();
  data.append("purpose", purpose);
  data.append("files", new File([new Uint8Array(size)], "media", { type }));
  return data;
};

describe("background media", () => {
  it("accepts MP4 and WebM explicitly uploaded for a background", () => {
    expect(mediaUploadSchema.safeParse(input("video/mp4", "background")).success).toBe(true);
    expect(mediaUploadSchema.safeParse(input("video/webm", "background")).success).toBe(true);
  });
  it("keeps icon uploads image-only", () => {
    expect(mediaUploadSchema.safeParse(input("video/mp4")).success).toBe(false);
    expect(mediaUploadSchema.safeParse(input("image/png")).success).toBe(true);
  });
  it("rejects executable media and videos larger than 32 MB", () => {
    expect(mediaUploadSchema.safeParse(input("text/html", "background")).success).toBe(false);
    expect(mediaUploadSchema.safeParse(input("video/mp4", "background", 32 * 1024 * 1024 + 1)).success).toBe(false);
  });
  it("recognizes video extensions with query strings and rejects unrelated files", () => {
    expect(externalBackgroundVideoType("https://example.com/wall.MP4?token=test")).toBe("video/mp4");
    expect(externalBackgroundVideoType("https://example.com/wall.png")).toBeNull();
  });
});
