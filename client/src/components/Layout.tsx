import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/upload", label: "Data Upload" },
  { to: "/configuration", label: "Configuration" },
  { to: "/schedule", label: "Schedule" },
  { to: "/branding", label: "Branding" },
];

export function Layout() {
  const { theme } = useTheme();

  return (
    <div className="app-shell">
      <header className="app-header">
        {theme?.logo_url && <img className="logo" src={theme.logo_url} alt="League logo" />}
        <h1>{theme?.header_text || "Soccer Season Scheduler"}</h1>
      </header>
      <nav className="app-nav">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
