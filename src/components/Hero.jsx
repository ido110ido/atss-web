export default function Hero() {
  return (
    <section id="hero">
      <div className="hero-label">
        Atias Software
        <br />
        Solutions — 2025
        <br />
        WhatsApp Logistics Bot
      </div>

      {/* Scribble top-left */}
      <svg className="scribble scribble-top" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10 60 C 20 20, 50 20, 60 60 C 70 100, 100 100, 110 60"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M5 80 C 30 50, 60 50, 80 80 C 90 95, 110 90, 115 75"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>

      {/* Scribble mid-right */}
      <svg className="scribble scribble-mid" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="30" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="8 5" />
        <circle cx="40" cy="40" r="18" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>

      <h1 className="hero-title">
        <span className="line">
          <span className="inner">Your shipment just arrived —</span>
        </span>
        <span className="line">
          <span className="inner">
            <span className="hero-underline">
              we&apos;ll WhatsApp you.
              <svg viewBox="0 0 700 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  d="M4 14 C 100 4, 250 4, 350 9 C 450 14, 600 14, 696 8"
                  stroke="#25D366"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M10 17 C 120 9, 280 9, 380 13 C 480 17, 620 16, 695 11"
                  stroke="#25D366"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.4"
                />
              </svg>
            </span>
          </span>
        </span>
      </h1>

      <div className="hero-bottom">
        <p className="hero-sub">
          ATSS builds a WhatsApp bot that monitors your supply chain and sends you a message the instant a shipment
          reaches any store location.
        </p>
        <a href="#bot" className="hero-btn">
          See the bot
          <svg viewBox="0 0 16 16">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </a>
      </div>
    </section>
  );
}
