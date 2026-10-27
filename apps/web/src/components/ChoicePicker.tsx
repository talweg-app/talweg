import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "../hooks/usePreferences.js";
import { Check, ChevronDown } from "lucide-react";

interface Choice { value: string; label: string; disabled?: boolean }
export function ChoicePicker({ label, value, options, onChange, icon, className = "" }: {
  label: string; value: string; options: readonly Choice[]; onChange: (value: string) => void; icon?: ReactNode; className?: string;
}) {
  const id = useId();
  const { interfaceScale } = usePreferences();
  const trigger = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 160, maxHeight: 300 });
  const available = options.filter(option => !option.disabled);
  const choose = (next: string) => { onChange(next); setOpen(false); trigger.current?.focus(); };
  const show = () => { setActive(value.length ? value : (available[0]?.value ?? "")); setOpen(true); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = interfaceScale;
      const width = Math.min(Math.max(rect.width, 164 * scale, Math.max(0, ...options.map(option => option.label.length)) * 7 * scale + 60 * scale), window.innerWidth - 16);
      const height = Math.min(320 * scale, options.length * 38 * scale + 12);
      const below = window.innerHeight - rect.bottom - 14;
      const top = below >= Math.min(height, 120) ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
      setPosition({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top, width, maxHeight: Math.max(72, window.innerHeight - top - 8) });
    };
    place();
    const frame = requestAnimationFrame(place);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) setOpen(false); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("pointerdown", outside, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", place); window.removeEventListener("scroll", scroll, true); window.removeEventListener("pointerdown", outside, true); };
  }, [open, options.length, interfaceScale]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, id, open]);
  return <label className={`choice-picker ${className}`}>
    {icon}<span className="choice-picker-label" aria-hidden="true">{options.find(option => option.value === value)?.label}</span><ChevronDown size={11} aria-hidden="true" />
    <select ref={trigger} value={value} aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined}
      onMouseDown={event => { if (event.button === 0) event.preventDefault(); }}
      onClick={event => { event.preventDefault(); }}
      onChange={event => { onChange(event.target.value); setOpen(false); }}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); trigger.current?.focus(); if (open) setOpen(false); else show(); }}
      onKeyDown={event => {
        if (event.key === "Tab") { setOpen(false); return; }
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "F4"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          if (!open) { show(); return; }
          if (event.key === "Enter" || event.key === " ") { if (active) choose(active); return; }
          const index = available.findIndex(option => option.value === active);
          const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + available.length) % available.length;
          setActive(available[next]?.value ?? active);
        }
      }}>
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="choice-menu" style={position} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}>
      {options.filter(option => !option.disabled).map(option => <div key={option.value} id={`${id}-${option.value}`} role="option" aria-selected={option.value === value} data-active={option.value === active} className="choice-option" onPointerMove={() => { setActive(option.value); }} onClick={() => { choose(option.value); }}>
        <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </label>;
}
