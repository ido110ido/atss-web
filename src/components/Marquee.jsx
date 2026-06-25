const ITEMS = [
  "WhatsApp Alerts",
  "Real-Time Tracking",
  "No App Needed",
  "Instant Notifications",
  "Store-Level Visibility",
  "Atias Software Solutions",
];

export default function Marquee() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div id="marquee-strip">
      <div className="marquee-track">
        {doubled.map((item, idx) => (
          <span className="marquee-item" key={idx}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
