import { useRef, useState } from "react";

export function MultiSelect({
  name,
  label,
  options,
  defaultValue = [],
  disabled = false,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue?: readonly string[];
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<readonly string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const toggle = (value: string) =>
    setSelected((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  return (
    <fieldset className="music-multiselect" disabled={disabled}>
      <legend>{label}</legend>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <details
        ref={details}
        name="music-metadata-options"
        open={disabled ? false : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && details.current) {
            details.current.open = false;
            details.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (disabled && (event.key === "Enter" || event.key === " ")) event.preventDefault();
          }}
        >
          {selected.length
            ? `${selected.length} selected`
            : disabled
              ? "None selected"
              : `Choose ${label.toLowerCase()}`}{" "}
          {disabled ? <span>Read-only</span> : <span aria-hidden="true">⌄</span>}
        </summary>
        <div className="music-multiselect__menu">
          <label className="sr-only" htmlFor={`${name}-search`}>
            Find {label.toLowerCase()}
          </label>
          <input
            id={`${name}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder={`Find ${label.toLowerCase()}`}
          />
          <div role="group" aria-label={`Available ${label.toLowerCase()}`}>
            {options
              .filter((value) => value.toLowerCase().includes(query.toLowerCase()))
              .map((value) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => toggle(value)}
                  />
                  {value}
                </label>
              ))}
            {!options.some((value) => value.toLowerCase().includes(query.toLowerCase())) ? (
              <p>No matching options.</p>
            ) : null}
          </div>
        </div>
      </details>
      <div className="music-multiselect__chips" aria-live="polite">
        {selected.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => toggle(value)}
          >
            {value} ×
          </button>
        ))}
      </div>
    </fieldset>
  );
}
