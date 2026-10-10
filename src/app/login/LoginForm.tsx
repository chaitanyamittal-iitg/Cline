"use client";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="card">
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <p>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </p>
    </form>
  );
}
