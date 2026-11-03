"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";
import { SubmitButton } from "../submit-button";

export function SignInForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(sendSignInLink, {});

  if (state.sentTo) {
    return (
      <div className="card stack" role="status">
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{state.sentTo}</strong>. Open the email
          and tap the link to sign in. It works for one hour.
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
        <p className="hint">We&rsquo;ll email you a link. No password needed.</p>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
    </form>
  );
}
