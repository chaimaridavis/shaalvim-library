"use client";

import { useActionState } from "react";
import { setNewPassword, type ResetState } from "./actions";
import { SubmitButton } from "../submit-button";
import { passwordRule } from "@/lib/validate";

export function ResetForm() {
  const [state, formAction] = useActionState<ResetState, FormData>(setNewPassword, {});

  return (
    <form action={formAction} className="stack" noValidate>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
        />
        <p className="hint">{passwordRule}</p>
      </div>
      <div className="field">
        <label htmlFor="confirm">Type it again</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
