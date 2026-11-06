import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Contact = { kind: "whatsapp" | "email"; value: string };

// What the signed-in member may see of another member's contact details,
// following that member's contact setting. The database decides.
export async function getContact(memberId: string): Promise<Contact | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_contact", { target: memberId }).maybeSingle<Contact>();
  return data ?? null;
}

// wa.me needs the number in international form without "+" or leading 0.
function whatsAppLink(number: string) {
  let digits = number.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

// A big button, or a plain link inside a card.
export function ContactButton({
  contact,
  name,
  style = "button",
}: {
  contact: Contact;
  name: string;
  style?: "button" | "link";
}) {
  const isWhatsApp = contact.kind === "whatsapp";
  const href = isWhatsApp ? whatsAppLink(contact.value) : `mailto:${contact.value}`;
  if (style === "link") {
    return (
      <a className="card-link" href={href} target={isWhatsApp ? "_blank" : undefined} rel="noreferrer">
        {isWhatsApp ? `Message ${name} on WhatsApp` : `Email ${name}`}
      </a>
    );
  }
  return (
    <>
      <a className="button full" href={href} target={isWhatsApp ? "_blank" : undefined} rel="noreferrer">
        {isWhatsApp && <ChatIcon />}
        {isWhatsApp ? "Message on WhatsApp" : `Email ${name}`}
      </a>
      <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
        {isWhatsApp ? "Only approved members can see this number." : contact.value}
      </p>
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginRight: 10 }}>
      <path
        d="M4 19.5 5.3 16A7.5 7.5 0 1 1 8 18.7L4 19.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
