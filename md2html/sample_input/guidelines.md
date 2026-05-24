# Team Guidelines for AI-Assisted Development

Practical guidelines for using AI tools effectively in day-to-day engineering work.

## Do's

- **Review every output** before committing — AI is a co-pilot, not autopilot
- **Provide full context** — paste error messages, stack traces, relevant code
- **Iterate** — if the first response misses the mark, refine your prompt
- **Save good prompts** — reuse prompts that worked well as team templates

## Don'ts

- Don't trust AI for security-critical decisions without a human review
- Don't paste credentials, PII, or confidential data into public AI tools
- Don't use AI output as a substitute for understanding the code

## When to Use AI

| Task | Recommended? |
|------|-------------|
| Boilerplate generation | Yes |
| Test case drafting | Yes |
| Architecture decisions | Assist only |
| Code review | Assist only |
| Security audits | No (human required) |
| Production incidents | No (human required) |

## Escalation Path

If the AI gives a response that seems incorrect or dangerous:

1. Stop and do not use the output
2. Document the prompt and response
3. Raise in the team Slack channel `#ai-review`
4. A senior engineer will review and update the relevant prompt template

## Onboarding New Team Members

New joiners should complete the internal **Context Engineering 101** module before using AI tools in production workflows. This covers:

- Understanding model limitations
- Prompt basics
- Our team standards (see `standards.md`)
- Escalation procedures
