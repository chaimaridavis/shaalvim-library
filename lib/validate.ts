export function cleanName(value: FormDataEntryValue | null): string | null {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 100 ? name : null;
}

export function cleanEmail(value: FormDataEntryValue | null): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

// Accepts Israeli and international numbers, with or without spaces and dashes.
export function cleanWhatsApp(value: FormDataEntryValue | null): string | null {
  const phone = String(value ?? "").trim();
  const digits = phone.replace(/[\s\-().]/g, "");
  return /^\+?\d{9,15}$/.test(digits) ? phone : null;
}
