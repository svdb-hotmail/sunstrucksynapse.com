import { useRef } from "react";

import { Contact } from "~/components/Contact";

export function ContactDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <section className="contact-launch" aria-labelledby="contact-launch-heading">
        <div>
          <p className="eyebrow">Contact</p>
          <h2 id="contact-launch-heading">Have something thoughtful to share?</h2>
          <p>Talk to us about the radio, an artist or release, visual work, or collaboration.</p>
        </div>
        <button type="button" onClick={() => dialogRef.current?.showModal()}>
          Contact SunSyn
        </button>
      </section>

      <dialog ref={dialogRef} className="contact-dialog" aria-labelledby="contact-heading">
        <div className="contact-dialog-frame">
          <button
            className="contact-dialog-close"
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <Contact />
        </div>
      </dialog>
    </>
  );
}
