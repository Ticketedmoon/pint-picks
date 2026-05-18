# BirdieBets ADR Skill

## When to Use

USE FOR: create ADR, document decision, add architecture decision record, document approach

## Repository Context

- **App:** BirdieBets - golf tournament betting tracker
- **Stack:** Next.js 16, TypeScript, Firebase, Tailwind CSS
- **ADR location:** `docs/adr/`
- **Numbering:** Sequential, zero-padded (e.g. `028-firestore-security-rules.md`)
- **Writing style:** Never use em dashes. Use commas, colons, periods, or hyphens instead.

## ADR Template

```markdown
# ADR-{NNN}: {Title}

## Status
Accepted

## Date
{YYYY-MM-DD}

## Context
{Why this decision was needed. What problem existed.}

## Decision
{What was decided. Include subsections for different aspects.}

## Consequences

### Positive
- {Benefit 1}
- {Benefit 2}

### Negative
- {Tradeoff 1}
```

## Workflow

1. Check existing ADRs: `ls docs/adr/` to find the next number
2. Create the file at `docs/adr/{NNN}-{slug}.md`
3. Follow the template above
4. Reference related ADRs with "Extends ADR-XXX" or "Supersedes ADR-XXX"
5. Commit with message: `Add ADR-{NNN} for {topic}`
