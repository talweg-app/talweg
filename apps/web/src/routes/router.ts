import { useEffect, useState } from "react";
import type { DocumentId, PageId } from "@talweg/core";

export type Route =
  | { type: "dashboard" }
  | { type: "board"; boardId: DocumentId; pageId?: PageId };

export function parseRoute(pathname: string, search = ""): Route {
  const searchParams = new URLSearchParams(search);
  const roomParam = searchParams.get("room");
  if (roomParam) {
    return { type: "board", boardId: `room-${roomParam}` as DocumentId };
  }

  const docParam = searchParams.get("doc");

  const boardPageMatch = /^\/board\/([^/]+)\/page\/([^/]+)\/?$/.exec(pathname);
  if (boardPageMatch?.[1] && boardPageMatch[2]) {
    return {
      type: "board",
      boardId: decodeURIComponent(boardPageMatch[1]) as DocumentId,
      pageId: decodeURIComponent(boardPageMatch[2]),
    };
  }

  const boardMatch = /^\/board\/([^/]+)\/?$/.exec(pathname);
  if (boardMatch?.[1]) {
    return {
      type: "board",
      boardId: decodeURIComponent(boardMatch[1]) as DocumentId,
    };
  }

  if (docParam) {
    return {
      type: "board",
      boardId: docParam as DocumentId,
    };
  }

  return { type: "dashboard" };
}

export function navigate(to: string, options?: { replace?: boolean }): void {
  if (typeof window === "undefined") return;
  if (options?.replace) {
    window.history.replaceState(window.history.state, "", to);
  } else {
    window.history.pushState({}, "", to);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): {
  route: Route;
  navigate: (to: string, options?: { replace?: boolean }) => void;
} {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === "undefined") return { type: "dashboard" };
    return parseRoute(window.location.pathname, window.location.search);
  });

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return { route, navigate };
}
