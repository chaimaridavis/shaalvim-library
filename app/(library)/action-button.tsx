"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./loan-actions";

// A button that runs one server action and shows its error, if any.
export function ActionButton({
  action,
  children,
  pendingText,
  className = "button full",
  confirm,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  // Ask first, for actions that are hard to undo.
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function go() {
    setAsking(false);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="action">
      {asking ? (
        <div className="confirm">
          <span className="small">{confirm}</span>
          <button type="button" className="button small-button" onClick={go}>
            Yes
          </button>
          <button type="button" className="button secondary small-button" onClick={() => setAsking(false)}>
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={className}
          disabled={pending}
          onClick={() => (confirm ? setAsking(true) : go())}
        >
          {pending ? pendingText : children}
        </button>
      )}
      {error && (
        <p className="error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
