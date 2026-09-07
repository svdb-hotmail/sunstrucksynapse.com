import { useId } from "react";

interface DiscoveryFacetProps {
  name: "genre" | "mood" | "year" | "process";
  label: string;
  allLabel: string;
  options: (string | number)[];
  selectedValue: string | number | null;
}

export function DiscoveryFacet({
  name,
  label,
  allLabel,
  options,
  selectedValue,
}: DiscoveryFacetProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const selected = selectedValue === null ? "" : String(selectedValue);
  const missingSelection = selected !== "" && !options.some((value) => String(value) === selected);
  const unavailable = options.length === 0;
  const explanation = missingSelection
    ? `The selected value is not available in the current catalogue. Choose ${allLabel.toLowerCase()} to clear it.`
    : unavailable
      ? `No ${label.toLowerCase()} values are available for published tracks.`
      : null;

  return (
    <div>
      <label htmlFor={id}>
        {label}
        <select
          id={id}
          name={name}
          defaultValue={selected}
          disabled={unavailable && !selected}
          aria-describedby={explanation ? helpId : undefined}
        >
          <option value="">{allLabel}</option>
          {missingSelection ? <option value={selected}>{selected} (unavailable)</option> : null}
          {options.map((value) => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {explanation ? <p id={helpId}>{explanation}</p> : null}
    </div>
  );
}
