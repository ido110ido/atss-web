import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const TABS = [
  { key: "deliveries", label: "Deliveries", to: "/dashboard" },
  { key: "completed", label: "Completed", to: "/completed" },
  { key: "workers", label: "Workers", to: "/workers" },
];

export default function AdminHeader({ active }) {
  const { user, signOutUser } = useAuth();

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <div className="logo">ATSS</div>
        <nav className="dashboard-nav">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className={`dashboard-nav-link${active === tab.key ? " is-active" : ""}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="dashboard-header-right">
        <span className="dashboard-user">{user.email}</span>
        <button className="nav-contact" type="button" onClick={signOutUser}>
          Sign out
        </button>
      </div>
    </header>
  );
}
