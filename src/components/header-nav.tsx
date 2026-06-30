"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "transition-colors",
        active
          ? "font-semibold text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export function HeaderNav({ isMaster }: { isMaster: boolean }) {
  const pathname = usePathname();
  const isScan = pathname === "/";
  const isHistory = pathname === "/history" || pathname.startsWith("/history/");
  const isReports =
    pathname === "/reports" || pathname.startsWith("/reports/");
  const isUsers =
    pathname === "/admin/users" || pathname.startsWith("/admin/users/");
  const isEmployees =
    pathname === "/admin/employees" ||
    pathname.startsWith("/admin/employees/");

  return (
    <nav className="flex items-center gap-4 text-sm">
      <NavLink href="/" active={isScan}>
        Escanear
      </NavLink>
      <NavLink href="/history" active={isHistory}>
        Historial
      </NavLink>
      <NavLink href="/reports" active={isReports}>
        Estado
      </NavLink>
      {isMaster && (
        <NavLink href="/admin/employees" active={isEmployees}>
          Empleados
        </NavLink>
      )}
      {isMaster && (
        <NavLink href="/admin/users" active={isUsers}>
          Usuarios
        </NavLink>
      )}
    </nav>
  );
}

export function UserMenu({ username }: { username: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
        <UserIcon className="h-3.5 w-3.5" />
        {username}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        disabled={busy}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
