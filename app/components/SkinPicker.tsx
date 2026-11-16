import { useRef, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { DEFAULT_SKIN, isSkin, setSkin as applySkin, SKINS } from "~/design-system/skin";

function subscribeSkin(changed: () => void) {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });
  return () => observer.disconnect();
}

function currentSkin() {
  const skin = document.documentElement.dataset.skin;
  return isSkin(skin) ? skin : DEFAULT_SKIN;
}

export function SkinPicker() {
  const skin = useSyncExternalStore(subscribeSkin, currentSkin, () => DEFAULT_SKIN);
  const menu = useRef<HTMLDetailsElement>(null);

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
