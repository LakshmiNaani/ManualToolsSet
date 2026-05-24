# Introduction to Context Engineering

Context engineering is the practice of deliberately crafting the information provided to an LLM to maximise the quality and relevance of its output.

## Why It Matters

Large language models are powerful but sensitive to context. The same question answered differently depending on:

- The **role** you assign to the model
- The **examples** you provide
- The **constraints** you specify
- The **format** you request

## Manual Inputs vs Templates

| Approach | Strength | Weakness |
|----------|----------|----------|
| Pure manual | Flexible, nuanced | Not repeatable |
| Pure template | Consistent, fast | Brittle for edge cases |
| **Hybrid** | **Best of both** | Requires upfront design |

The hybrid approach combines human judgement (manual inputs) with structured templates to produce outputs that are both consistent and contextually appropriate.

## Getting Started

1. Identify the **goal** of your prompt
2. Choose which parts benefit from templates
3. Design the manual input fields that guide the template
4. Iterate based on output quality
