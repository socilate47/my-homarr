import z from "zod";
import { zfd } from "zod-form-data";

import { createCustomErrorParams } from "./form/i18n";

export const supportedMediaUploadFormats = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
export const supportedBackgroundUploadFormats = [...supportedMediaUploadFormats, "video/mp4", "video/webm"];

export const externalBackgroundVideoType = (url: string): string | null => {
  try {
    const extension = new URL(url, "https://homarr.invalid").pathname.split(".").pop()?.toLowerCase();
    return extension && ["mp4", "webm", "ogg"].includes(extension) ? `video/${extension}` : null;
  } catch { return null; }
};

export const mediaUploadSchema = zfd.formData({
  purpose: zfd.text(z.enum(["image", "background"]).default("image")),
  files: zfd.repeatable(
    z.array(
      zfd.file().check((context) => {
        if (!supportedBackgroundUploadFormats.includes(context.value.type)) {
          context.issues.push({
            code: "custom",
            params: createCustomErrorParams({
              key: "invalidFileType",
              params: { expected: `one of ${supportedBackgroundUploadFormats.join(", ")}` },
            }),
            input: context.value.type,
          });
          return;
        }

        if (context.value.size > 1024 * 1024 * 32) {
          // Don't forget to update the limit in nginx.conf (client_max_body_size)
          context.issues.push({
            code: "custom",
            params: createCustomErrorParams({
              key: "fileTooLarge",
              params: { maxSize: "32 MB" },
            }),
            input: context.value.size,
          });
          return;
        }
      }),
    ),
  ),
}).superRefine((data, context) => {
  data.files.forEach((file, index) => {
    if (data.purpose === "image" && !supportedMediaUploadFormats.includes(file.type)) {
      context.addIssue({ code: "custom", path: ["files", index], params: createCustomErrorParams({ key: "invalidFileType", params: { expected: "image" } }) });
    }
  });
});
