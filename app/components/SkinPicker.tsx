import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { DEFAULT_SKIN, setSkin as applySkin, SKINS, type Skin } from "~/design-system/skin";

export function SkinPicker() {
  const [skin, setSkin] = useState<Skin>(DEFAULT_SKIN);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.skin;
    if (current === "editorial" || current === "underground" || current === "synth") {
      setSkin(current);
    }
  }, []);

  return (
    <details className="skin-picker" ref={menu}>
      <summary aria-label={`Design direction: ${skin}`}>
        <span>Style</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="skin-picker__menu" role="group" aria-label="Design direction">
        {SKINS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={skin === option}
            onClick={() => {
              applySkin(option, document);
              setSkin(option);
              menu.current?.removeAttribute("open");
            }}
          >
            {option}
          </button>
        ))}
        {import.meta.env.MODE === "test" ? (
          <div className="skin-picker__fixtures">
            <Link to="/?identity-preview=1" onClick={() => menu.current?.removeAttribute("open")}>
              Three-artist study
            </Link>
            <Link to="/?identity-preview=0" onClick={() => menu.current?.removeAttribute("open")}>
              Standard catalogue
            </Link>
          </div>
        ) : null}
      </div>
    </details>
  );
}
