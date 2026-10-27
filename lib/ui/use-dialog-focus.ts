"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement: HTMLDivElement = dialog;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblingElements = new Set<HTMLElement>();
    let branch: HTMLElement = dialogElement;
    while (branch.parentElement) {
      for (const element of Array.from(branch.parentElement.children)) {
        if (element instanceof HTMLElement && element !== branch) siblingElements.add(element);
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    const hiddenSiblings = Array.from(siblingElements)
      .map((element) => ({ element, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") }));
    for (const { element } of hiddenSiblings) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    const focusFrame = requestAnimationFrame(() => {
      const preferred = dialogElement.querySelector<HTMLElement>("[data-autofocus]");
      const first = dialogElement.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? dialogElement).focus();
    });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKey);
      for (const { element, inert, ariaHidden } of hiddenSiblings) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose, open]);

  return dialogRef;
}
