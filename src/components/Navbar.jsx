const NAV_ITEMS = [
  { id: "hero", label: "Overview" },
  { id: "bot", label: "The Bot" },
  { id: "how", label: "How It Works" },
  { id: "contact", label: "Contact" },
];

export default function Navbar() {
  return (
    <div className="nav-w" id="nav-w">
      <div className="nav">
        <div className="logo">ATSS</div>
        <a href="#contact" className="nav-contact">
          Get In Touch
        </a>
      </div>
      <div className="sub-nav-wrap">
        <ul className="sub-nav" id="subnav" role="list">
          {NAV_ITEMS.map((item, idx) => (
            <li key={item.id} className={`sub-nav-item${idx === 0 ? " current" : ""}`} data-to={item.id}>
              {item.label}
              {idx === 0 && <div className="sub-nav-highlight" id="highlight" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
