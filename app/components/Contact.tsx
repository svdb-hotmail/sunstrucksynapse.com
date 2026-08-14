export function Contact() {
  return (
    <section id="contact" className="contact">
      <div>
        <p className="eyebrow">Contact</p>
        <h2>Send the signal.</h2>
        <p>Send a short brief, references, and the type of audio/video/portfolio work you need delivered.</p>
      </div>

      <form action="mailto:hello@sunstrucksynapse.com" method="get">
        <label>Name <input name="name" required autoComplete="name" /></label>
        <label>Email <input name="email" type="email" required autoComplete="email" /></label>
        <label>
          Project type
          <select name="project_type" required defaultValue="">
            <option value="">Choose one</option>
            <option>Audio</option>
            <option>Video</option>
            <option>Portfolio</option>
            <option>Creative system</option>
          </select>
        </label>
        <label>Message <textarea name="message" rows={5} required /></label>
        <button type="submit">Launch message</button>
      </form>
    </section>
  );
}
