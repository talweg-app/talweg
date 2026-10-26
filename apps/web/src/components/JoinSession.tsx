import { updatePreferences } from "../utils/preferences.js";
import { useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { parseInvitation, rememberInvitation } from "../utils/invitation.js";
import { navigate } from "../routes/router.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function JoinSession() {
  const { t } = useTranslation();
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("talweg_display_name") ?? "";
    } catch {
      return "";
    }
  });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="join-session-trigger"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        <Users size={15} />
        {t("collaboration.join")}
      </button>
      {open && (
        <div
          className="join-session-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={t("collaboration.join")}
            className="collaboration-panel join-session-panel"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const invitation = parseInvitation(text);
                try {
                  updatePreferences({ displayName: name.trim() || "Guest" });
                } catch {
                  /* joining also works without a saved display name */
                }
                rememberInvitation(invitation);
                navigate(
                  `/board/room-${invitation.room}?room=${invitation.room}`,
                );
                setOpen(false);
              } catch (failure) {
                setError(
                  failure instanceof Error && failure.message === "version"
                    ? "invitationVersion"
                    : "invitationInvalid",
                );
              }
            }}
          >
            <div className="collaboration-heading">
              <strong>{t("collaboration.join")}</strong>
              <button
                type="button"
                aria-label={t("inspector.close")}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            </div>
            <p>{t("collaboration.joinHint")}</p>
            <label>
              {t("collaboration.yourName")}
              <input
                value={name}
                maxLength={40}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder={t("collaboration.guestName")}
              />
            </label>
            <label>
              {t("collaboration.invite")}
              <input
                autoFocus
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError("");
                }}
                placeholder="talweg://join/…"
                aria-invalid={!!error}
              />
            </label>
            {error && <p role="alert">{t(`collaboration.${error}`)}</p>}
            <button
              className="collaboration-primary"
              type="submit"
              disabled={!text.trim()}
            >
              {t("collaboration.connect")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
