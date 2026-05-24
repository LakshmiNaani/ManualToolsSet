# Prompt Engineering Standards

These standards define how our team writes prompts for LLM-assisted workflows.

## Standard 1 — Role Declaration

Every system prompt **must** begin with a role declaration:

```
You are a [role] with expertise in [domain].
Your goal is to [primary objective].
```

> A clear role reduces hallucination and anchors the model's behaviour.

## Standard 2 — Output Format Specification

Always specify the expected output format explicitly:

- Use `JSON` for machine-readable outputs
- Use `Markdown` for human-readable reports
- Use `CSV` for tabular data exports

```
Respond only in valid JSON matching this schema:
{ "summary": string, "items": string[], "confidence": number }
```

## Standard 3 — Few-Shot Examples

Include at least **2 examples** for non-trivial tasks:

```
Input: "Fix the login bug"
Output: { "type": "bug", "priority": "high", "component": "auth" }

Input: "Add dark mode toggle"
Output: { "type": "feature", "priority": "medium", "component": "ui" }
```

## Standard 4 — Constraint Blocks

Use a dedicated constraints section to set hard limits:

```
Constraints:
- Do not generate code longer than 50 lines
- Never suggest breaking changes to the public API
- Respond in under 200 words
```

## Review Checklist

- [ ] Role declared?
- [ ] Output format specified?
- [ ] At least 2 examples provided?
- [ ] Constraints listed?
- [ ] Tested against 3+ edge cases?
