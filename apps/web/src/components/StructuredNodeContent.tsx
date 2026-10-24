import type { CSSProperties } from "react";
import type { ChecklistNode, NodeId, TableNode, TextRun } from "@talweg/core";
import { Plus, Minus } from "lucide-react";
import { RichText } from "./RichText.js";
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
  if (node.type === "checklist") {
    const items = node.data.items;
    return (
      <div
        className="structured-node checklist-node"
        style={{ ...surfaceStyle, ...textStyle }}
      >
        <RichText
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
                label={t("insert.task")}
                placeholder={t("insert.task")}
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
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
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
                            color:
                              node.data.cellStyles[
                                `${String(rowIndex)}:${String(columnIndex)}`
                              ]?.textColor,
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
                      label={`${t("insert.cell")} ${String(rowIndex + 1)}, ${String(columnIndex + 1)}`}
                      placeholder={
                        rowIndex === 0
                          ? `${t("insert.column")} ${String(columnIndex + 1)}`
                          : "—"
                      }
                      text={cell}
                      runs={
                        node.textRuns?.[
                          `cell:${String(rowIndex)}:${String(columnIndex)}`
                        ]
                      }
                      onCommit={(text, runs) => {
                        onUpdateData(node.id, {
                          cells: cells.map((currentRow, r) =>
                            r === rowIndex
                              ? currentRow.map((currentCell, c) =>
                                  c === columnIndex ? text : currentCell,
                                )
                              : currentRow,
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
              cells: [...cells, Array.from({ length: columns }, () => "")],
            });
          }}
        >
          <Plus size={12} />
          {t("insert.row")}
        </button>
        <button
          type="button"
          onClick={() => {
            onUpdateData(node.id, { cells: cells.map((row) => [...row, ""]) });
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
              cells: cells.slice(0, -1),
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
              cells: cells.map((row) => row.slice(0, -1)),
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
