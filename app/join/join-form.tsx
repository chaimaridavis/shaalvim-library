"use client";

import { useActionState } from "react";
import { askToJoin, type JoinState } from "./actions";
import { SubmitButton } from "../submit-button";

export function JoinForm() {
  const [state, formAction] = useActionState<JoinState, FormData>(askToJoin, {});

  return (
    <form action={formAction} className="stack" noValidate>
      <div className="field">
        <label htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          name="full_name"
          className="input"
          placeholder="First and last name"
          autoComplete="name"
          defaultValue={state.values?.full_name}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          placeholder="you@example.com"
          autoComplete="email"
          defaultValue={state.values?.email}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="whatsapp">WhatsApp number</label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          className="input"
          placeholder="050-000-0000"
          autoComplete="tel"
          defaultValue={state.values?.whatsapp}
          required
        />
        <p className="hint">Only approved members can see your number.</p>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pendingText="Sending…">Ask to join</SubmitButton>
    </form>
  );
}
