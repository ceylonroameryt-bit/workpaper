/**
 * Email and password rules shared by the sign-up forms and the server, so both say the same thing.
 */

// One @, no spaces, a dotted domain with a 2+ letter ending; no leading, trailing or double dots
const EMAIL_RE = /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+'-]*[A-Za-z0-9_%+'-])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Common slips in popular domains, offered as a suggestion
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.co.uk',
  'outlok.com': 'outlook.com',
  'yahooo.com': 'yahoo.com',
  'icloud.co': 'icloud.com',
};

/** Returns an error message, or null when the email is valid. */
export function emailError(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'Enter your work email.';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'Enter a valid email address, like name@practice.co.uk.';
  const domain = email.split('@')[1].toLowerCase();
  if (DOMAIN_TYPOS[domain]) return `Did you mean ${email.split('@')[0]}@${DOMAIN_TYPOS[domain]}?`;
  return null;
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** Each password rule and whether it is met. `context` is the person's name and email, which the password must not contain. */
export function passwordChecks(password: string, context: { email?: string; name?: string } = {}): PasswordCheck[] {
  const lower = password.toLowerCase();
  const personal = [context.email?.split('@')[0], ...(context.name || '').split(/\s+/)]
    .map((s) => (s || '').toLowerCase())
    .filter((s) => s.length >= 3);
  return [
    { label: 'At least 12 characters', ok: password.length >= 12 },
    { label: 'An uppercase and a lowercase letter', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
    { label: 'A symbol, like ! ? # or £', ok: /[^A-Za-z0-9\s]/.test(password) },
    { label: 'Not your name or email', ok: password.length > 0 && !personal.some((p) => lower.includes(p)) },
  ];
}

/** Returns the first unmet rule as an error message, or null when the password is acceptable. */
export function passwordError(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length > 200) return 'Use a password of 200 characters or fewer.';
  const miss = passwordChecks(password, context).find((c) => !c.ok);
  return miss ? `Password needs: ${miss.label.toLowerCase()}.` : null;
}
