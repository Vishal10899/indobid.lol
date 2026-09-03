/**
 * INDOBID — PAYMENT METADATA & NOTES SANITIZER
 * Enforces strict UTF-8 validity, prevents malformed UTF-16 surrogates,
 * protects Razorpay notes constraints, and prevents arbitrary user-generated
 * text or emojis from entering external payment provider payloads.
 */

const MAX_NOTE_KEY_LENGTH = 40;
const MAX_NOTE_VALUE_LENGTH = 256;
const MAX_NOTES_ENTRIES = 15;

// Forbidden note keys: User-generated rich text must NEVER enter Razorpay notes
const FORBIDDEN_NOTE_KEYS = new Set([
  'title',
  'posttitle',
  'post_title',
  'content',
  'postcontent',
  'post_content',
  'description',
  'desc',
  'bio',
  'body',
  'argument',
  'argumentcontent',
  'argument_content',
  'usergenerated',
  'user_generated',
]);

// Regular expression to identify and remove unpaired / malformed UTF-16 surrogates
const UNPAIRED_SURROGATE_REGEX =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// Regular expression to remove emoji characters from payment notes if present
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

/**
 * Sanitizes a single note value for safe transmission to payment providers.
 * - Safely converts any input to string
 * - Defensively handles null and undefined
 * - Normalizes Unicode using NFC
 * - Removes malformed/unpaired UTF-16 surrogates
 * - Ensures valid UTF-8 encoding
 * - Strips control characters
 * - Safely enforces character length limits without splitting surrogate pairs
 */
export function sanitizePaymentNote(value: unknown, maxLength: number = MAX_NOTE_VALUE_LENGTH): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  if (str.length === 0) {
    return '';
  }

  // 1. Normalize Unicode (NFC canonical decomposition followed by canonical composition)
  try {
    str = str.normalize('NFC');
  } catch {
    // If normalization fails due to malformed string, continue with raw string
  }

  // 2. Remove malformed/unpaired UTF-16 surrogates
  str = str.replace(UNPAIRED_SURROGATE_REGEX, '');

  // 3. Use toWellFormed if available in runtime
  if (typeof (str as any).toWellFormed === 'function') {
    str = (str as any).toWellFormed();
    // Re-clean any replacement characters generated from lone surrogates
    str = str.replace(/\uFFFD/g, '');
  }

  // 4. Remove control characters (except space)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  // 5. Enforce safe length by Unicode code points (never cut surrogate pairs)
  const codePoints = Array.from(str);
  if (codePoints.length > maxLength) {
    str = codePoints.slice(0, maxLength).join('');
  }

  // 6. Ensure roundtrip UTF-8 buffer validity
  try {
    str = Buffer.from(str, 'utf-8').toString('utf-8');
  } catch {
    str = '';
  }

  return str.trim();
}

/**
 * Sanitizes user-generated text for external provider metadata if text is strictly required.
 * Removes emojis and control characters while preserving alphanumeric and valid international text.
 */
export function sanitizeUserTextForNote(value: unknown, maxLength: number = MAX_NOTE_VALUE_LENGTH): string {
  const baseSanitized = sanitizePaymentNote(value, maxLength);
  if (!baseSanitized) return '';

  // Strip emojis from external note value to satisfy strict ASCII/UTF-8 provider filters
  let clean = baseSanitized.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim();

  const codePoints = Array.from(clean);
  if (codePoints.length > maxLength) {
    clean = codePoints.slice(0, maxLength).join('').trim();
  }

  return clean;
}

/**
 * Sanitizes a note key name to ensure it conforms to alphanumeric and underscore constraints.
 */
export function sanitizePaymentNoteKey(key: unknown, maxLength: number = MAX_NOTE_KEY_LENGTH): string {
  if (key === null || key === undefined) {
    return '';
  }

  return String(key)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, maxLength)
    .trim();
}

/**
 * Builds a clean, provider-safe Razorpay notes object.
 * - Strips forbidden user-generated rich text keys (title, content, bio, description)
 * - Sanitizes all retained keys and values
 * - Enforces Razorpay's 15-entry limit
 * - Enforces 40-char key and 256-char value length limits
 */
export function buildSafeRazorpayNotes(
  rawNotes: Record<string, unknown> = {}
): Record<string, string> {
  const safeNotes: Record<string, string> = {};

  if (!rawNotes || typeof rawNotes !== 'object') {
    return safeNotes;
  }

  let count = 0;
  for (const [rawKey, rawVal] of Object.entries(rawNotes)) {
    if (count >= MAX_NOTES_ENTRIES) {
      break;
    }

    if (rawVal === undefined || rawVal === null) {
      continue;
    }

    const cleanKey = sanitizePaymentNoteKey(rawKey);
    if (!cleanKey) {
      continue;
    }

    const lowerKey = cleanKey.toLowerCase();
    // Discard any forbidden rich text keys
    if (FORBIDDEN_NOTE_KEYS.has(lowerKey)) {
      continue;
    }

    const cleanVal = sanitizePaymentNote(rawVal);
    if (cleanVal.length > 0) {
      safeNotes[cleanKey] = cleanVal;
      count++;
    }
  }

  return safeNotes;
}
