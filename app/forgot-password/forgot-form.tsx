"use client";

import { useActionState } from "react";
import { sendResetLink, type ForgotState } from "./actions";
import { SubmitButton } from "../submit-button";

export function ForgotForm() {
  const [state, formAction] = useActionState<ForgotState, FormData>(sendResetLink, {});

  if (state.sentTo) {
    return (
      <div className="card stack" role="status">
        <h2>Check your email</h2>
        <p>
          If <strong>{state.sentTo}</strong> belongs to a member, we&rsquo;ve sent it a
          link to choose a new password. The link works for one hour.
        </p>
        <p className="muted small">
          Nothing there after a few minutes? Look in your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="stack" noValidate>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          placeholder="you@example.com"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
        <p className="hint">We&rsquo;ll email you a link to choose a new password.</p>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pendingText="Sending…">Email me a link</SubmitButton>
    </form>
  );
}
