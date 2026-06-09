# PintPicks Email Template Skill

## When to Use

USE FOR: create email, email template, notification email, send email, build email

## Repository Context

- **App:** PintPicks - multi-sport tournament pool tracker
- **Email service:** Resend (`src/lib/resend.ts`)
- **Templates:** `src/lib/emailTemplates.ts`
- **Tests:** `src//__tests__/emailTemplates.test.ts`
- **Writing style:** Never use em dashes.

## Existing Templates

| Template | Purpose |
|---|---|
| `buildInviteEmail` | Party invitation |
| `buildUnlockEmail` | Pick unlock link |
| `buildInvalidPicksEmail` | Invalid picks warning |
| `buildMajorReminderEmail` | Upcoming major notification |

## Template Helpers

```typescript
// Available in emailTemplates.ts:
escapeHtml(str)           // Escape HTML for safe injection
emailWrapper(icon, html)  // Wraps content in branded layout with footer
ctaButton(href, label, color?)  // Green CTA button (default #15803d)
```

## Template Pattern

```typescript
export function buildMyEmail(params: {
  displayName: string;
  // other params
}): { subject: string; html: string } {
  const { displayName } = params;
  return {
    subject: `Subject line with ${escapeHtml(displayName)}`,
    html: emailWrapper("emoji", `
      <h1 style="color: #15803d; font-size: 22px; text-align: center;">Title</h1>
      <p style="color: #4b5563; text-align: center; font-size: 15px;">
        Hi <strong>${escapeHtml(displayName)}</strong>, body text here.
      </p>
      ${ctaButton("https://url", "Button Label")}
    `),
  };
}
```

## Workflow

1. Add template function to `src/lib/emailTemplates.ts`
2. Always use `escapeHtml()` on user-provided strings
3. Add tests in `src/__tests__/emailTemplates.test.ts`:
   - Subject contains key info
   - HTML contains display name
   - HTML contains CTA link
   - XSS test: HTML-escapes injected tags
4. Run `npm run test:coverage` - emailTemplates must be 100%

