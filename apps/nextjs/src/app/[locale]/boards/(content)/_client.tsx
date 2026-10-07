"use client";

import { useEffect } from "react";
import { Box, Stack } from "@mantine/core";

import { clientApi } from "@homarr/api/client";
import { useCurrentLayout, useRequiredBoard } from "@homarr/boards/context";
import { useEditMode } from "@homarr/boards/edit-mode";

import { BoardCategorySection } from "~/components/board/sections/category-section";
import { BoardEmptySection } from "~/components/board/sections/empty-section";
import { BoardBackgroundVideo } from "~/components/layout/background";

export const ClientBoard = () => {
  const board = useRequiredBoard();
  const currentLayoutId = useCurrentLayout();
  const [editing] = useEditMode();
  const utils = clientApi.useUtils();
  const revision = clientApi.discovery.boardRevision.useQuery({ boardId: board.id }, { refetchInterval: 15000, enabled: !editing });
  const revisionValue = revision.data?.revision;
  useEffect(() => {
    if (editing || revisionValue === undefined) return;
    void utils.board.getBoardByName.invalidate({ name: board.name });
    void utils.app.invalidate();
  }, [revisionValue, editing, board.name, utils]);

  const fullWidthSortedSections = board.sections
    .filter((section) => section.kind === "empty" || section.kind === "category")
    .toSorted((sectionA, sectionB) => sectionA.yOffset - sectionB.yOffset);

  return (
    <Box h="100%" pos="relative" data-homarr-dev-benchmark-board>
      <BoardBackgroundVideo />
      <Stack h="100%" pos="relative" style={{ zIndex: 1 }}>
        {fullWidthSortedSections.map((section) =>
          section.kind === "empty" ? (
            <BoardEmptySection key={`${currentLayoutId}-${section.id}`} section={section} />
          ) : (
            <BoardCategorySection key={`${currentLayoutId}-${section.id}`} section={section} />
          ),
        )}
      </Stack>
    </Box>
  );
};
