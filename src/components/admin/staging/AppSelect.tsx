// Design: Novinet's shared select replaces browser dropdowns with a compact Persian operational popover across all staging forms.
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./app-select.css";

type AppSelectOption<T extends string> = { value: T; label: string; hint?: string };

export function AppSelect<T extends string>({ value, options, onChange, ariaLabel, disabled = false }: { value: T; options: AppSelectOption<T>[]; onChange: (value: T) => void; ariaLabel: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const move = (direction: 1 | -1) => { const index = Math.max(0, options.findIndex((option) => option.value === value)); onChange(options[(index + direction + options.length) % options.length].value); };
  return <div className="app-select" ref={root}><button type="button" className="app-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); if (open) move(1); else setOpen(true); } if (event.key === "ArrowUp") { event.preventDefault(); if (open) move(-1); else setOpen(true); } }}><span><b>{selected?.label}</b>{selected?.hint && <small>{selected.hint}</small>}</span><ChevronDown className={open ? "open" : ""} size={16} /></button>{open && <div id={listId} className="app-select-popover" role="listbox" aria-label={ariaLabel}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpen(false); }}><span><b>{option.label}</b>{option.hint && <small>{option.hint}</small>}</span>{option.value === value && <Check size={14} />}</button>)}</div>}</div>;
}
