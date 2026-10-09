import type { ReactNode } from "react";
import hero from "@/assets/hero-library.jpg";
import { Logo } from "./bits";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="bg-hero-overlay absolute inset-0" />
        <div className="absolute bottom-10 left-10 right-10 text-navy-foreground">
          <p className="font-display text-3xl">"A library is the delivery room for the birth of ideas."</p>
          <p className="mt-2 text-sm opacity-70">— Norman Cousins</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Logo />
          <h1 className="mt-8 text-3xl font-medium">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}
