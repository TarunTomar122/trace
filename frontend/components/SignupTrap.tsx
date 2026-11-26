import { TRAP_FIELD } from '@/lib/signup-trap-field';

/**
 * Hidden field for the email signup forms (see lib/signup-guard.ts). People never see it, screen readers and
 * the keyboard skip it, and password managers are told not to fill it; form-filling bots usually do.
 */
export function SignupTrap() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Leave this empty
        <input
          type="text"
          name={TRAP_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
        />
      </label>
    </div>
  );
}

/** The trap field's value, keyed for the request body ('' for people). Read it before any await. */
export function trapValue(form: EventTarget | null): Record<string, string> {
  const value = form instanceof HTMLFormElement ? new FormData(form).get(TRAP_FIELD) : null;
  return { [TRAP_FIELD]: typeof value === 'string' ? value : '' };
}
