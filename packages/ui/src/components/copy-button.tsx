"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * navigator.clipboard only exists in secure contexts (HTTPS or localhost), but Homarr is
 * often opened over plain HTTP on a LAN address. Fall back to a hidden textarea there.
 */
export const copyToClipboardAsync = async (value: string) => {
  if (window.isSecureContext && typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  // Modals trap focus, so attach to the focused element's container when possible.
  const container = document.activeElement?.closest("[role=dialog]") ?? document.body;
  container.appendChild(textarea);
  textarea.select();
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only clipboard API available outside secure contexts
    if (!document.execCommand("copy")) throw new Error("Copy command was rejected");
  } finally {
    textarea.remove();
  }
};

interface CopyButtonProps {
  value: string;
  timeout?: number;
  children: (payload: { copied: boolean; copy: () => void }) => ReactNode;
}

/** Drop-in replacement for Mantine's CopyButton that also works over plain HTTP. */
export const CopyButton = ({ value, timeout = 1000, children }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    copyToClipboardAsync(value)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), timeout);
      })
      .catch(() => setCopied(false));
  };

  return <>{children({ copied, copy })}</>;
};
