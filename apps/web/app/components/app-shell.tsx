import { apiClient, type Role } from "@quizmaster/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BookOpen, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/auth.js";

const learnerLinks = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/analytics", label: "Progress", icon: BarChart3 },
];
const adminLinks = [
  { to: "/admin", label: "Overview", icon: ShieldCheck },
  { to: "/admin/content", label: "Content", icon: BookOpen },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AppShell({ requiredRole }: { requiredRole: Role }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const logout = useMutation({
    mutationFn: apiClient.logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      navigate("/login");
    },
  });

  if (auth.isPending) return <div className="screen-loader"><span /></div>;
  if (!auth.data) return <RedirectPanel title="Your session has ended" href="/login" action="Sign in" />;
  if (auth.data.role !== requiredRole) {
    return <RedirectPanel title="This workspace is not available to your account" href={auth.data.role === "ADMIN" ? "/admin" : "/app"} action="Open your workspace" />;
  }

  const links = requiredRole === "ADMIN" ? adminLinks : learnerLinks;
  return (
    <div className="app-frame">
      <header className="mobile-header">
        <Link to={requiredRole === "ADMIN" ? "/admin" : "/app"} className="brand"><BrandMark /> QuizMaster</Link>
        <button className="icon-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link to={requiredRole === "ADMIN" ? "/admin" : "/app"} className="brand"><BrandMark /> QuizMaster</Link>
        <p className="workspace-label">{requiredRole === "ADMIN" ? "Administration" : "Learner workspace"}</p>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="account-line">
            <span className="avatar">{(auth.data.displayName ?? auth.data.email).slice(0, 1).toUpperCase()}</span>
            <span><strong>{auth.data.displayName ?? "QuizMaster user"}</strong><small>{auth.data.email}</small></span>
          </div>
          <button className="nav-link" onClick={() => logout.mutate()}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      <main className="workspace">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function RedirectPanel({ title, href, action }: { title: string; href: string; action: string }) {
  return <main className="error-page"><p className="eyebrow">QuizMaster</p><h1>{title}</h1><Link className="button primary" to={href}>{action}</Link></main>;
}
