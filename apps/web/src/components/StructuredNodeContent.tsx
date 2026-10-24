import type { CSSProperties } from "react";
import type { ChecklistNode, NodeId, TableNode } from "@talweg/core";
import { Plus, Minus } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";

interface StructuredNodeContentProps {
  node: ChecklistNode | TableNode;
  onUpdateData: (id: NodeId, data: Record<string, unknown>) => void;
  surfaceStyle: CSSProperties;
  textStyle: CSSProperties;
}

export function StructuredNodeContent({
  node,
  onUpdateData,
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
        <input
          className="checklist-title"
          aria-label={t("insert.planTitle")}
          placeholder={t("insert.planTitle")}
          value={node.data.title}
          onChange={(e) => {
            onUpdateData(node.id, { title: e.target.value });
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
              <input
                type="text"
                aria-label={t("insert.task")}
                placeholder={t("insert.task")}
                value={entry.text}
                style={{
                  textDecoration: entry.checked ? "line-through" : undefined,
                  opacity: entry.checked ? 0.5 : 1,
                }}
                onChange={(e) => {
                  onUpdateData(node.id, {
                    items: items.map((candidate) =>
                      candidate.id === entry.id
                        ? { ...candidate, text: e.target.value }
                        : candidate,
                    ),
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onUpdateData(node.id, {
                      items: [
                        ...items,
                        { id: crypto.randomUUID(), text: "", checked: false },
                      ],
                    });
                  }
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
                  <td key={columnIndex}>
                    <input
                      aria-label={`${t("insert.cell")} ${String(rowIndex + 1)}, ${String(columnIndex + 1)}`}
                      placeholder={
                        rowIndex === 0
                          ? `${t("insert.column")} ${String(columnIndex + 1)}`
                          : "—"
                      }
                      value={cell}
                      onChange={(e) => {
                        onUpdateData(node.id, {
                          cells: cells.map((currentRow, r) =>
                            r === rowIndex
                              ? currentRow.map((currentCell, c) =>
                                  c === columnIndex
                                    ? e.target.value
                                    : currentCell,
                                )
                              : currentRow,
                          ),
                        });
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
            onUpdateData(node.id, { cells: cells.slice(0, -1) });
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
