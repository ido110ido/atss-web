const STEPS = [
  {
    num: "01",
    title: "Connects to your tracking",
    body: "Links into your existing shipment system — no app migration, no new dashboards. Just hooks into what you already use.",
  },
  {
    num: "02",
    title: "Monitors 24/7",
    body: "Watches every active shipment around the clock. The moment an order hits a store, the bot catches it.",
  },
  {
    num: "03",
    title: "Sends you a WhatsApp",
    body: "A clear message lands in your chat — store name, order number, item count, exact arrival time. No noise, just facts.",
  },
];

const MESSAGES = [
  {
    type: "in",
    store: "Hadera Branch",
    order: "ORD-44219",
    items: 24,
    time: "09:41",
  },
  {
    type: "out",
    text: "Got it, thanks",
    time: "09:42 ✓✓",
  },
  {
    type: "in",
    store: "Tel Aviv North",
    order: "ORD-44231",
    items: 60,
    time: "11:15",
  },
  {
    type: "in",
    store: "Be'er Sheva South",
    order: "ORD-44256",
    items: 12,
    time: "14:03",
  },
];

function Bubble({ message }) {
  if (message.type === "out") {
    return (
      <div className="bbl bbl-out">
        {message.text}
        <div className="bbl-time">{message.time}</div>
      </div>
    );
  }

  return (
    <div className="bbl bbl-in">
      <span className="bbl-green">✅ Shipment Arrived</span>
      <br />
      Store: {message.store}
      <br />
      Order #{message.order}
      <br />
      Items: {message.items} units
      <br />
      Time: {message.time}
      <div className="bbl-time">{message.time}</div>
    </div>
  );
}

export default function BotSection() {
  return (
    <section id="bot">
      <div className="bot-left">
        <div className="sec-label">The Bot</div>
        {STEPS.map((step) => (
          <div className="bot-step" key={step.num}>
            <span className="bot-step-num">{step.num}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bot-right">
        <div className="phone">
          <div className="phone-bar">
            <div className="phone-avatar">🤖</div>
            <div className="phone-info">
              <div className="name">ATSS Bot</div>
              <div className="status">online</div>
            </div>
          </div>
          <div className="phone-body">
            {MESSAGES.map((message, idx) => (
              <Bubble message={message} key={idx} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
