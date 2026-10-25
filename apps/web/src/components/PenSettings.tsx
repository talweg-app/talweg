import { useTranslation } from "../hooks/useTranslation.js";

const colors = ["#8caecc", "#83b7a3", "#cb8584", "#b09acb", "#d5a17d"];
export function PenSettings({
  color,
  width,
  onColor,
  onWidth,
}: {
  color: string | null;
  width: number;
  onColor: (color: string | null) => void;
  onWidth: (width: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="pen-settings"
      role="toolbar"
      aria-label={t("pen.settings")}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="pen-auto-color"
        aria-label={t("pen.autoColor")}
        title={t("pen.autoColor")}
        aria-pressed={color === null}
        onClick={() => {
          onColor(null);
        }}
      >
        A
      </button>
      {colors.map((value) => (
        <button
          key={value}
          type="button"
          className="pen-color"
          aria-label={`${t("pen.color")} ${value}`}
          aria-pressed={color === value}
          title={value}
          style={{ background: value }}
          onClick={() => {
            onColor(value);
          }}
        />
      ))}
      <input
        type="color"
        aria-label={t("pen.customColor")}
        value={color ?? "#8caecc"}
        onChange={(event) => {
          onColor(event.target.value);
        }}
      />
      <select
        aria-label={t("pen.width")}
        value={width}
        onChange={(event) => {
          onWidth(Number(event.target.value));
        }}
      >
        {[1, 2, 3, 5, 8].map((size) => (
          <option key={size} value={size}>
            {size} px
          </option>
        ))}
      </select>
      <span>{t("pen.escape")}</span>
    </div>
  );
}
