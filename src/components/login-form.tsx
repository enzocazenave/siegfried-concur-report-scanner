"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        let message = "Error al iniciar sesión.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* ignore */
        }
        toast.error(message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="items-center text-center">
        <Image
          src="/siegfried.png"
          alt="Siegfried"
          width={514}
          height={158}
          priority
          className="mb-2 h-12 w-auto dark:brightness-110"
        />
        <CardTitle>Informes Concur</CardTitle>
        <p className="text-sm text-muted-foreground">Iniciá sesión para continuar.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
