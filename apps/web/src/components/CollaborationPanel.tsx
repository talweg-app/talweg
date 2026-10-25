import { JoinSession } from "./JoinSession.js";
import { useEffect, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import type { PeerState } from "../utils/peerSession.js";

export function CollaborationPanel({
  state,
  onStart,
  onStop,
  onApprove,
  onSaveCopy,
  onFocusPeer,
}: {
  state: PeerState;
  onStart: () => Promise<void>;
  onStop: () => void;
  onApprove: (id: string, accept: boolean) => void;
  onSaveCopy: () => Promise<string>;
  onFocusPeer: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copyUrl, setCopyUrl] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = state.phase === "waiting" || state.phase === "connected";
  const invite = state.invite ?? "";
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("pointerdown", pointer);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="collaboration-trigger"
        aria-label={t("collaboration.open")}
        title={t("collaboration.open")}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setCopiedRoom("");
        }}
      >
        <Users size={15} />
        {state.phase !== "off" && <span data-phase={state.phase} />}
      </button>
      {open && (
        <div
          ref={panel}
          className="collaboration-panel"
          role="dialog"
          aria-label={t("collaboration.title")}
        >
          <div className="collaboration-heading">
            <strong>{t("collaboration.title")}</strong>
            <button
              type="button"
              aria-label={t("inspector.close")}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }}
            >
              <X size={15} />
            </button>
          </div>
          <p>{t("collaboration.intro")}</p>
          <div
            role="status"
            className="collaboration-status"
            data-phase={state.phase}
          >
            {t(`collaboration.${state.phase}`)}
            {state.phase === "connected"
              ? ` · ${String(state.participants?.length ?? 1)}`
              : ""}
          </div>
          {active && (
            <>
              <label>
                {t("collaboration.invite")}
                <input
                  readOnly
                  aria-label={t("collaboration.invite")}
                  value={invite}
                  onFocus={(event) => {
                    event.target.select();
                  }}
                />
              </label>
              <button
                type="button"
                className="collaboration-primary"
                onClick={() => {
                  void (async () => {
                    try {
                      await navigator.clipboard.writeText(invite);
                      setCopiedRoom(state.room);
                    } catch {
                      setCopiedRoom("");
                      panel.current
                        ?.querySelector("input")
                        ?.focus({ preventScroll: true });
                    }
                  })();
                }}
              >
                {t(
                  copiedRoom === state.room
                    ? "collaboration.copied"
                    : "collaboration.copy",
                )}
              </button>
            </>
          )}
          {(state.phase === "off" ||
            (state.phase === "unavailable" && state.host)) && (
            <button
              type="button"
              className="collaboration-primary"
              onClick={() => {
                void onStart();
              }}
            >
              {t("collaboration.start")}
            </button>
          )}
          {state.phase !== "off" && (
            <button
              type="button"
              className="collaboration-stop"
              onClick={onStop}
            >
              {t(state.host ? "collaboration.stop" : "collaboration.leave")}
            </button>
          )}
          {state.phase === "off" && <JoinSession />}
          {state.pending?.map((request) => (
            <div className="join-request" key={request.id}>
              <span>{request.name}</span>
              <button
                type="button"
                onClick={() => {
                  onApprove(request.id, true);
                }}
              >
                {t("collaboration.accept")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onApprove(request.id, false);
                }}
              >
                {t("collaboration.reject")}
              </button>
            </div>
          ))}
          {!!state.participants?.length && (
            <div className="session-members">
              {state.participants.map((peer) => (
                <button
                  type="button"
                  key={peer.id}
                  disabled={
                    peer.id === state.selfId ||
                    peer.x === null ||
                    peer.y === null
                  }
                  title={t("collaboration.goToPeer")}
                  onClick={() => {
                    onFocusPeer(peer.id);
                    setOpen(false);
                  }}
                >
                  <span style={{ background: peer.color }} />
                  {peer.name}
                </button>
              ))}
            </div>
          )}
          {!state.host && state.phase !== "off" && (
            <button
              type="button"
              className="collaboration-stop"
              disabled={savingCopy}
              onClick={() => {
                setSavingCopy(true);
                setCopyError(false);
                void onSaveCopy()
                  .then(setCopyUrl)
                  .catch(() => {
                    setCopyError(true);
                  })
                  .finally(() => {
                    setSavingCopy(false);
                  });
              }}
            >
              {t("collaboration.saveCopy")}
            </button>
          )}
          {copyUrl && (
            <a href={copyUrl} target="_blank" rel="noopener noreferrer">
              {t("collaboration.openCopy")}
            </a>
          )}
          {copyError && (
            <small role="alert">{t("collaboration.copyFailed")}</small>
          )}
          {!!state.unsent && (
            <small role="status">
              {t("collaboration.unsent")} · {state.unsent}
            </small>
          )}
          <small>{t("collaboration.localFirst")}</small>
          <small>{t("collaboration.lifetime")}</small>
        </div>
      )}
    </>
  );
}
