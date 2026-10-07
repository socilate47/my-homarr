"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Group, Text } from "@mantine/core";
import type { AppShellProps } from "@mantine/core";

import { clientApi } from "@homarr/api/client";
import { useOptionalBoard } from "@homarr/boards/context";
import { useScopedI18n } from "@homarr/translation/client";
import { externalBackgroundVideoType } from "@homarr/validation/media";

export const useBackgroundMediaType = (url: string | null | undefined) => {
  const mediaId = url?.match(/^\/api\/user-medias\/([a-zA-Z0-9_-]+)(?:[?#].*)?$/)?.[1];
  const metadata = clientApi.media.getMetadata.useQuery({ id: mediaId ?? "" }, { enabled: Boolean(mediaId), staleTime: 300000 });
  return mediaId ? metadata.data?.contentType ?? null : externalBackgroundVideoType(url ?? "") ?? "image/unknown";
};

export const useOptionalBackgroundProps = (): Partial<AppShellProps> => {
  const board = useOptionalBoard();
  const pathname = usePathname();
  const contentType = useBackgroundMediaType(board?.backgroundImageUrl);
  const segments = pathname.split("/").filter(Boolean);
  const boardSegment = segments.indexOf("boards");
  if (!board?.backgroundImageUrl || boardSegment === -1 || segments.length > boardSegment + 2 || !contentType || contentType.startsWith("video/")) return {};
  return { bg: `url(${board.backgroundImageUrl})`, bgp: "center center", bgsz: board.backgroundImageSize, bgr: board.backgroundImageRepeat, bga: board.backgroundImageAttachment };
};

export const BoardBackgroundVideo = () => {
  const board = useOptionalBoard();
  const contentType = useBackgroundMediaType(board?.backgroundImageUrl);
  const t = useScopedI18n("wallpaper");
  const video = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = board?.backgroundImageUrl;
  useEffect(() => { setFailed(false); setPlayback("auto"); }, [url]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const synchronize = () => {
      if (document.hidden || playback === "pause" || (playback === "auto" && reducedMotion.matches)) element.pause();
      else void element.play().catch(() => setPlaying(false));
    };
    synchronize();
    document.addEventListener("visibilitychange", synchronize);
    reducedMotion.addEventListener("change", synchronize);
    return () => {
      element.pause();
      document.removeEventListener("visibilitychange", synchronize);
      reducedMotion.removeEventListener("change", synchronize);
    };
  }, [url, contentType, playback, failed]);
  if (!url || !contentType?.startsWith("video/")) return null;
  return <>
    {!failed && <video key={url} ref={video} muted loop playsInline aria-hidden="true" preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}
      style={{ position: "fixed", width: "100vw", height: "100vh", inset: 0, objectFit: board?.backgroundImageSize === "contain" ? "contain" : "cover", pointerEvents: "none", zIndex: 0 }}>
      <source src={url} type={contentType} />
    </video>}
    <Group style={{ position: "fixed", bottom: 12, right: 12, zIndex: 2 }}>
      {failed ? <Text size="xs" role="status">{t("unavailable")}</Text> : <Button size="xs" variant="default" aria-pressed={!playing} onClick={() => setPlayback(playing ? "pause" : "play")}>{playing ? t("pause") : t("play")}</Button>}
    </Group>
  </>;
};
