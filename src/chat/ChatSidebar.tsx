import type { ComponentProps } from "react";
import { ThreadRail } from "./ThreadRail";

export function ChatSidebar(
  props: ComponentProps<typeof ThreadRail> & {
    narrow: boolean;
    drawerOpen: boolean;
    onCloseDrawer: () => void;
  },
) {
  const { narrow, drawerOpen, onCloseDrawer, ...railProps } = props;
  const rail = <ThreadRail {...railProps} />;
  if (!narrow) return rail;
  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        aria-hidden="true"
        onClick={onCloseDrawer}
        className="absolute inset-0 bg-overlay"
      />
      <div className="relative flex h-full">{rail}</div>
    </div>
  );
}
