"use client";

import { useActionState, useState } from "react";
import type { Member } from "@/lib/auth";
import { SubmitButton } from "../../submit-button";
import { saveProfile, type ProfileState } from "./actions";

function LimitStepper({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial: number | null;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const id = `${name}-label`;
  return (
    <div className="setting-row">
      <span id={id}>{label}</span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-label="Fewer"
          onClick={() => setValue((v) => (v === null || v <= 1 ? null : v - 1))}
        >
          &minus;
        </button>
        <output aria-live="polite">{value === null ? "No limit" : value}</output>
        <button
          type="button"
          aria-label="More"
          onClick={() => setValue((v) => (v === null ? 1 : Math.min(v + 1, 99)))}
        >
          +
        </button>
      </div>
      <input type="hidden" name={name} value={value ?? ""} />
    </div>
  );
}

export function ProfileForm({
  member,
  email,
  whatsapp,
  notice,
}: {
  member: Member;
  email: string;
  whatsapp: string;
  notice?: string;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(saveProfile, {
    saved: notice,
  });

  return (
    <form action={formAction} noValidate>
      <div className="stack">
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            name="full_name"
            className="input"
            autoComplete="name"
            defaultValue={member.full_name}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            defaultValue={email}
          />
        </div>
        <div className="field">
          <label htmlFor="whatsapp">WhatsApp number</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            className="input"
            autoComplete="tel"
            defaultValue={whatsapp}
          />
          <p className="hint">
            Members see your number only after you accept their request to borrow a book.
          </p>
        </div>
      </div>


      <h2 style={{ marginTop: 32 }}>Lending limits</h2>
      <p className="muted small" style={{ marginTop: 8 }}>
        Optional. When you reach a limit, new requests go on the waitlist.
      </p>
      <LimitStepper
        name="max_lent_at_once"
        label="Most books I lend out at one time"
        initial={member.max_lent_at_once}
      />
      <LimitStepper
        name="max_per_borrower"
        label="Most books one person can borrow from me at one time"
        initial={member.max_per_borrower}
      />
      <div className="setting-row">
        <label htmlFor="reminder_after">Remind a borrower to return a book after</label>
        <select
          id="reminder_after"
          name="reminder_after"
          className="select"
          defaultValue={member.reminder_after}
        >
          <option value="two_weeks">2 weeks</option>
          <option value="one_month">1 month</option>
          <option value="two_months">2 months</option>
          <option value="never">Never</option>
        </select>
      </div>

      <h2 style={{ marginTop: 32 }}>Pause lending</h2>
      <label className="choice" style={{ marginTop: 16 }}>
        <input type="checkbox" name="lending_paused" defaultChecked={member.lending_paused} />
        <div>
          <strong>Pause lending for now</strong>
          <span>
            Your books stay on the shelf, but nobody can request them until you turn
            this off. Waitlists are kept.
          </span>
        </div>
      </label>

      <div className="stack" style={{ marginTop: 28 }}>
        {state.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
        {state.saved && (
          <p className="notice" role="status">
            {state.saved}
          </p>
        )}
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
