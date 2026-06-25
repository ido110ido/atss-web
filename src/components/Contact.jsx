import { useState } from "react";
import { CONTACT_FORM_ENDPOINT } from "../config";

const LABELS = {
  idle: "Send Message",
  sending: "Sending…",
  sent: "Sent ✓",
  error: "Something went wrong — try again",
};

export default function Contact() {
  const [status, setStatus] = useState("idle");

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value,
      email: form.email.value,
      company: form.company.value,
      message: form.message.value,
    };

    setStatus("sending");
    try {
      // Apps Script web apps don't return CORS headers, so the response is
      // opaque — "no-cors" just confirms the request reached the network.
      await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contact">
      <div className="contact-left">
        <div className="sec-label">Contact</div>
        <h2 className="sec-title" style={{ marginBottom: 20 }}>
          Want this
          <br />
          for your
          <br />
          business?
        </h2>
        <p className="contact-intro">Tell us about your setup and we&apos;ll reach back out. Simple as that.</p>
        <div className="contact-email-block">
          <div className="contact-email-label">Email</div>
          <div className="contact-email-value">ido110ido@gmail.com</div>
        </div>
      </div>
      <div className="contact-right">
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <input className="field" type="text" name="name" placeholder="Your name" required />
            <input className="field" type="email" name="email" placeholder="Email" required />
          </div>
          <input className="field" type="text" name="company" placeholder="Company name" />
          <textarea
            className="field"
            name="message"
            placeholder="What does your logistics setup look like? How many stores?"
          />
          <button
            className={`btn-send${status === "sent" ? " is-sent" : ""}${status === "error" ? " is-error" : ""}`}
            type="submit"
            disabled={status === "sending"}>
            {LABELS[status]}
          </button>
        </form>
      </div>
    </section>
  );
}
