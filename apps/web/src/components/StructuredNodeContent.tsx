import type { CSSProperties } from "react";
import type { ChecklistNode, NodeId, TableNode, TextRun } from "@talweg/core";
import { Plus, Minus } from "lucide-react";
import { RichText } from "./RichText.js";
import { useTheme } from "../hooks/useTheme.js";
import { canvasBackground } from "../themeContext.js";
import {
  ensureTextContrast,
  resolveFillColor,
} from "../utils/colorContrast.js";
import { useTranslation } from "../hooks/useTranslation.js";

interface StructuredNodeContentProps {
  node: ChecklistNode | TableNode;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
  onUpdateRuns: (id: NodeId, field: string, runs: TextRun[]) => void;
  surfaceStyle: CSSProperties;
  textStyle: CSSProperties;
}

export function StructuredNodeContent({
  node,
  onUpdateData,
  onUpdateRuns,
  surfaceStyle,
  textStyle,
}: StructuredNodeContentProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const backgroundColor = resolveFillColor(
    node.style.fillColor ?? "#242729",
    canvasBackground[theme],
  );
  if (node.type === "checklist") {
    const items = node.data.items;
    return (
      <div
        className="structured-node checklist-node"
        style={{ ...surfaceStyle, ...textStyle }}
      >
        <RichText
          backgroundColor={backgroundColor}
          field="title"
          className="checklist-title"
          label={t("insert.planTitle")}
          placeholder={t("insert.planTitle")}
          text={node.data.title}
          runs={node.textRuns?.title}
          multiline={false}
          onCommit={(text, runs) => {
            onUpdateData(node.id, { title: text });
            onUpdateRuns(node.id, "title", runs);
          }}
        />
        <div className="checklist-items">
          {items.map((entry) => (
            <div key={entry.id} className="checklist-item">
              <input
                type="checkbox"
                aria-label={`${t("insert.complete")} ${entry.text}`}
                checked={entry.checked}
                onChange={(e) => {
                  onUpdateData(node.id, {
                    items: items.map((candidate) =>
                      candidate.id === entry.id
                        ? { ...candidate, checked: e.target.checked }
                        : candidate,
                    ),
                  });
                }}
              />
              <RichText
                backgroundColor={backgroundColor}
                label={t("insert.task")}
                placeholder={t("insert.task")}
                field={`task:${entry.id}`}
                text={entry.text}
                runs={node.textRuns?.[`task:${entry.id}`]}
                multiline={false}
                style={{
                  textDecoration: entry.checked ? "line-through" : undefined,
                  opacity: entry.checked ? 0.5 : 1,
                }}
                onCommit={(text, runs) => {
                  onUpdateData(node.id, {
                    items: items.map((candidate) =>
                      candidate.id === entry.id
                        ? { ...candidate, text }
                        : candidate,
                    ),
                  });
                  onUpdateRuns(node.id, `task:${entry.id}`, runs);
                }}
              />
              <button
                type="button"
                aria-label={t("insert.removeTask")}
                onClick={() => {
                  onUpdateData(node.id, {
                    items: items.filter(
                      (candidate) => candidate.id !== entry.id,
                    ),
                  });
                }}
              >
                <Minus size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="structured-add"
          onClick={() => {
            onUpdateData(node.id, {
              items: [
                ...items,
                { id: crypto.randomUUID(), text: "", checked: false },
              ],
            });
          }}
        >
          <Plus size={13} />
          {t("insert.addTask")}
        </button>
      </div>
    );
  }
  const cells = node.data.cells;
  const columns = cells[0]?.length ?? 1;
  return (
    <div
      className="structured-node table-node"
      style={{ ...surfaceStyle, ...textStyle }}
    >
      <div className="table-scroll">
        <table>
          <tbody>
            {cells.map((row, rowIndex) => (
              <tr key={node.data.rowIds?.[rowIndex] ?? rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={node.data.columnIds?.[columnIndex] ?? columnIndex}
                    data-table-cell={`${String(rowIndex)}:${String(columnIndex)}`}
                    style={
                      node.data.cellStyles?.[
                        `${String(rowIndex)}:${String(columnIndex)}`
                      ]
                        ? {
                            backgroundColor:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.fillColor,
                            color: ensureTextContrast(
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.textColor ??
                                node.style.textColor ??
                                "#eeeeeb",
                              resolveFillColor(
                                node.data.cellStyles[
                                  `${String(rowIndex)}:${String(columnIndex)}`
                                ]?.fillColor ?? backgroundColor,
                                backgroundColor,
                              ),
                            ),
                            borderColor:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.strokeColor,
                            borderWidth:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.strokeWidth,
                            borderStyle:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.strokeDash === "dashed"
                                ? "dashed"
                                : node.data.cellStyles[
                                      `${String(rowIndex)}:${String(columnIndex)}`
                                    ]?.strokeDash === "dotted"
                                  ? "dotted"
                                  : "solid",
                            fontSize:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.fontSize,
                            fontWeight:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.fontWeight,
                            textAlign:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.textAlign,
                          }
                        : undefined
                    }
                  >
                    <RichText
                      backgroundColor={resolveFillColor(
                        node.data.cellStyles?.[
                          `${String(rowIndex)}:${String(columnIndex)}`
                        ]?.fillColor ?? backgroundColor,
                        backgroundColor,
                      )}
                      label={`${t("insert.cell")} ${String(rowIndex + 1)}, ${String(columnIndex + 1)}`}
                      placeholder={
                        rowIndex === 0
                          ? `${t("insert.column")} ${String(columnIndex + 1)}`
                          : "—"
                      }
                      field={`cell:${String(rowIndex)}:${String(columnIndex)}`}
                      text={cell}
                      runs={
                        node.textRuns?.[
                          `cell:${String(rowIndex)}:${String(columnIndex)}`
                        ]
                      }
                      onPasteGrid={(text) => {
                        const row = node.data.rowIds?.[rowIndex];
                        const column = node.data.columnIds?.[columnIndex];
                        if (
                          !row ||
                          !column ||
                          !/[\t\n]/.test(text) ||
                          text.startsWith("talweg-fragment:")
                        )
                          return false;
                        onUpdateData(node.id, { _grid: { row, column, text } });
                        return true;
                      }}
                      onCommit={(text, runs) => {
                        const row = node.data.rowIds?.[rowIndex];
                        const column = node.data.columnIds?.[columnIndex];
                        if (row && column)
                          onUpdateData(node.id, {
                            _cell: { row, column, text },
                          });
                        else
                          onUpdateData(node.id, {
                            cells: cells.map((values, r) =>
                              r === rowIndex
                                ? values.map((value, c) =>
                                    c === columnIndex ? text : value,
                                  )
                                : values,
                            ),
                          });
                        onUpdateRuns(
                          node.id,
                          `cell:${String(rowIndex)}:${String(columnIndex)}`,
                          runs,
                        );
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-actions">
        <button
          type="button"
          onClick={() => {
            onUpdateData(node.id, {
              _tableAction: { kind: "addRow", id: crypto.randomUUID() },
            });
          }}
        >
          <Plus size={12} />
          {t("insert.row")}
        </button>
        <button
          type="button"
          onClick={() => {
            onUpdateData(node.id, {
              _tableAction: { kind: "addColumn", id: crypto.randomUUID() },
            });
          }}
        >
          <Plus size={12} />
          {t("insert.column")}
        </button>
        <button
          type="button"
          disabled={cells.length <= 1}
          aria-label={t("insert.removeRow")}
          title={t("insert.removeRow")}
          onClick={() => {
            onUpdateData(node.id, {
              _tableAction: { kind: "removeRow", id: node.data.rowIds?.at(-1) },
              cellStyles: Object.fromEntries(
                Object.entries(node.data.cellStyles ?? {}).filter(
                  ([key]) => Number(key.split(":")[0]) < cells.length - 1,
                ),
              ),
            });
          }}
        >
          <Minus size={12} />
          {t("insert.row")}
        </button>
        <button
          type="button"
          disabled={columns <= 1}
          aria-label={t("insert.removeColumn")}
          title={t("insert.removeColumn")}
          onClick={() => {
            onUpdateData(node.id, {
              _tableAction: {
                kind: "removeColumn",
                id: node.data.columnIds?.at(-1),
              },
              cellStyles: Object.fromEntries(
                Object.entries(node.data.cellStyles ?? {}).filter(
                  ([key]) => Number(key.split(":")[1]) < columns - 1,
                ),
              ),
            });
          }}
        >
          <Minus size={12} />
          {t("insert.column")}
        </button>
      </div>
    </div>
  );
}
