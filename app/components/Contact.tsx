export function Contact() {
  return (
    <section id="contact" className="contact">
      <div>
        <p className="eyebrow">Contact</p>
        <h2>Send the signal.</h2>
        <p>
          Get in touch about the radio, the artists and music we feature, or a thoughtful
          collaboration.
        </p>
      </div>

      <form action="mailto:hello@sunstrucksynapse.com" method="get">
        <label>
          Name <input name="name" required autoComplete="name" />
        </label>
        <label>
          Email <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Subject
          <select name="subject" required defaultValue="">
            <option value="">Choose one</option>
            <option>The radio</option>
            <option>Music or artist</option>
            <option>Visual work</option>
            <option>Collaboration</option>
          </select>
        </label>
        <label>
          Message <textarea name="message" rows={5} required />
        </label>
        <button type="submit">Launch message</button>
      </form>
    </section>
  );
}
