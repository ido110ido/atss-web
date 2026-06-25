const STEPS = [
  {
    num: "01",
    title: "Connect",
    body: "We integrate with your existing logistics system, WMS, or carrier feeds. No rip-and-replace — a lightweight connection alongside what you already have.",
  },
  {
    num: "02",
    title: "Monitor",
    body: "The bot watches every active shipment 24/7. It polls carrier events and store check-in data, looking for the moment any order lands at a location.",
  },
  {
    num: "03",
    title: "Notify",
    body: "The instant an arrival is detected, a WhatsApp message is sent to whoever needs to know — store manager, logistics team, or the owner directly.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how">
      <div className="sec-header">
        <div>
          <div className="sec-label">How It Works</div>
          <h2 className="sec-title">
            Three steps.
            <br />
            Zero hassle.
          </h2>
        </div>
        <p className="sec-sub">
          Set it up once and forget about it. The bot handles everything else while you focus on running your
          business.
        </p>
      </div>
      <div className="steps-grid">
        {STEPS.map((step) => (
          <div className="step-card" key={step.num}>
            <div className="step-n">{step.num}</div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
