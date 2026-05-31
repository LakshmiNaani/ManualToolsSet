# AI Assist Extension — Guide

A Chrome extension that injects AI capabilities into all ManualToolsSet local HTML tools without modifying any HTML file. One extension, one API key, every tool.

---

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** → select the `ai-assist-extension/` folder
4. Click the extension card → **Details** → enable **"Allow access to file URLs"**

> This last step is required. Chrome blocks extension injection into `file://` pages unless you manually enable it.

---

## First-time setup

1. Click the **✦** extension icon in Chrome's toolbar
2. Click **Options & API Key**
3. Choose your AI provider and enter credentials (see [AI Providers](#ai-providers) below)
4. Click **Save Settings**, then **Test Connection**

---

## How it works

When you open any local HTML tool (`file:///.../task_tracker/index.html`, etc.), the extension:

1. Injects a floating **✦** blue button at the bottom-right corner of the page
2. Detects which tool is open by probing `localStorage` keys, then falls back to `document.title`
3. Shows AI feature buttons specific to that tool
4. Reads the app's data from `localStorage` when you click a feature
5. Sends the prompt to your configured AI provider via the background service worker
6. Displays the result inside an isolated panel — no page styles leak in or out
7. Optionally **applies** the result back into the app's data (patches `localStorage` then calls the app's own render function)

API keys are stored in Chrome's encrypted `chrome.storage.sync` — never in any app's `localStorage` or any HTML file.

---

## The panel

```
┌──────────────────────────────────────┐
│ ✦ AI Assist        [task_tracker] [✕]│
├──────────────────────────────────────┤
│ [Analyze Tasks] [Auto-Tag] [Add Task]│  ← app-specific buttons
├──────────────────────────────────────┤
│  [ optional text input ]             │  ← appears on hover for input-based features
├──────────────────────────────────────┤
│                                      │
│   AI response (scrollable)           │
│                                      │
├──────────────────────────────────────┤
│ [Apply]   [Copy]            [Dismiss]│
└──────────────────────────────────────┘
```

- **Apply** — writes the AI result back into the app (only shown for features that support it)
- **Copy** — copies raw result to clipboard
- **Dismiss** — clears the response area

---

## Supported tools and features

### Task Tracker (`task_tracker_v1`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Analyze Tasks** | Reads all active tasks, returns focus summary + top risks + recommended actions | No — read-only insight |
| **Auto-Tag** | Suggests 2–3 tags for each untagged task, reusing existing tag vocabulary | Yes — patches `tags[]` on each task, calls `render()` |
| **Draft a Task** | Takes your description, generates a full task with title, notes, priority, category, tags | Yes — appends task to list, calls `render()` |
| **Fix Priorities** | Finds overdue tasks, recommends priority adjustments with reasons | Yes — patches `priority` field on affected tasks, calls `render()` |

### Checklist Builder (`checklist_builder_v1`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Expand Section** | Given a section name, adds 5 new actionable items to it | Yes — appends items to section, calls `render()` |
| **Generate Checklist** | Given a topic, generates a full checklist with 3–5 sections and 4–6 items each | Yes — replaces sections entirely, calls `render()` |

### Work Log (`work_log_v1`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Daily Summary** | Reads today's entries, writes a narrative paragraph summary | No — display + copy |
| **Weekly Report** | Reads the past 7 days of entries, returns a structured "Completed / In Progress / Highlights" summary | No — display + copy |
| **Log an Entry** | Takes your description of what you worked on, formats it as a proper log entry | Yes — prepends entry to log, calls `save()` then `render()` |

### Prompt Builder (`pb_roles`, `pb_plans`, etc.)

| Feature | What it does | Writes back? |
|---|---|---|
| **Improve Role** | Rewrites the active role's system prompt to be clearer and more effective | Yes — patches `systemPrompt` in `pb_roles`, calls `render()` |
| **Test Prompts** | Generates 3 diverse user messages that test the active role's boundaries | No — display + copy |
| **Suggest a Role** | Takes your description, creates a full named role with system prompt | Yes — appends role to `pb_roles`, calls `render()` |

### Mind Map (`mind_map_v1`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Expand Node** | Given a node name, suggests 5 new child concepts not already in the map | Yes — adds nodes radially + connecting edges, calls `draw()` |
| **Find Connections** | Analyzes existing nodes, suggests new conceptual links with explanations | No — display + copy |
| **Summarize Map** | Reads all nodes, writes a 3–4 sentence description of the map's themes | No — display + copy |

### Text to Markdown (`text2md_state`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Improve Section** | Given a section heading, rewrites that section's body to be clearer and better structured | Yes — patches section in `localStorage`, updates DOM textarea directly |
| **Generate Outline** | Given a topic, creates a full document structure with headings and placeholder content | Yes — writes to `localStorage` (reload to see full effect) |

### World Clock (`world_clock_v1`)

| Feature | What it does | Writes back? |
|---|---|---|
| **Suggest Zones** | Given team location names (e.g. "London, Tokyo"), returns correct IANA timezone identifiers | Yes — merges into `timezones[]`, calls `render()` or reloads |
| **Best Meeting Time** | Reads configured timezones, finds the best 1-hour window within 9am–6pm in all zones | No — display + copy |

### JSON/YAML Tools, Diff Viewer, Flow Builder, Text to Flow, Workflow Diagram Builder

These tools are stateless (no `localStorage`). The panel works with selected text:

| Feature | What it does |
|---|---|
| **Explain** / **Explain Diff** | Explains selected text in plain English |
| **Fix Schema** | Analyzes selected JSON/YAML, returns corrected version with change notes |
| **Suggest Steps** / **Suggest Stages** | Given your description, returns a numbered list of process steps |
| **Improve Input** | Rewrites selected text to be clearer for diagram conversion |

**How to use:** Select text in the tool, open the AI panel, click the feature.

### Any other page

If the extension can't identify the tool, it falls back to **"Ask About Selection"** mode — select any text on the page and ask a question about it.

---

## AI Providers

All providers are configured in **Options** (extension icon → Options & API Key). Only one is active at a time.

### Google Gemini (recommended)

- Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free tier available
- Models: `gemini-2.5-flash` (default, fast), `gemini-2.5-flash-lite` (fastest), `gemini-2.5-pro` (most capable)
- Uses the OpenAI-compatible Gemini endpoint — no CORS issues from the background service worker
- **Setup:** Paste key → Save → Test Connection

### Ollama (fully local, no internet)

- Requires [Ollama](https://ollama.com) installed and a model downloaded (`ollama pull llama3.2`)
- **CORS setup required** — Ollama blocks cross-origin requests by default. Start Ollama with:
  ```
  OLLAMA_ORIGINS=* ollama serve
  ```
  On Windows (PowerShell):
  ```powershell
  $env:OLLAMA_ORIGINS="*"; ollama serve
  ```
- Default URL: `http://localhost:11434`
- Model name: whatever you have pulled (check with `ollama list`)
- **Best for:** Complete privacy — no data leaves your machine

### Claude (Anthropic)

- Get a key at [console.anthropic.com](https://console.anthropic.com)
- Models: `claude-haiku-4-5-20251001` (fast/cheap), `claude-sonnet-4-6` (balanced)
- **Setup:** Paste key → Save → Test Connection

### OpenAI

- Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Models: `gpt-4o-mini` (fast/cheap), `gpt-4o` (more capable)
- **Setup:** Paste key → Save → Test Connection

### MCP Server (advanced)

- For users already running a local MCP HTTP server that proxies to any AI backend
- The extension POSTs `{ prompt, max_tokens }` to `<your-url>/prompt`
- Configure the server URL in Options (default: `http://localhost:8000`)
- **When to use:** Only if you already have an MCP server set up; direct provider access is simpler otherwise

---

## Write-back safety

When "Apply" is clicked:

1. The extension re-reads `localStorage` fresh (ignores the copy read at panel-open time)
2. Patches only the relevant fields
3. Writes back to `localStorage`
4. Calls the app's render function — never calls the app's `saveState()` after writing (that would overwrite the changes with stale in-memory state)

Each app uses its own render function: `render()` for most, `draw()` for Mind Map, `save()` + `render()` for Work Log, direct DOM manipulation for Text to Markdown.

---

## Privacy

| What | Where it goes |
|---|---|
| API key | `chrome.storage.sync` (Chrome's encrypted storage) — never in any HTML file |
| App data (tasks, logs, etc.) | Sent to your configured AI provider when you click a feature |
| Ollama | Never leaves your machine |
| Gemini / Claude / OpenAI | Sent to provider's API over HTTPS |

---

## Troubleshooting

**Panel doesn't appear on a tool page**
- Check that "Allow access to file URLs" is enabled: `chrome://extensions` → AI Assist → Details

**"Extension error" or no response**
- Open Options → Test Connection to verify the provider is reachable
- For Ollama: ensure you started it with `OLLAMA_ORIGINS=*`

**Apply does nothing**
- The "Apply" button only appears for features that support write-back and on tools with `localStorage` state
- Stateless tools (JSON/YAML Tools, Diff Viewer, etc.) only support Copy

**Features show wrong app name**
- The extension detects apps by `localStorage` key first. If the tool has never been opened before (empty localStorage), it falls back to `document.title` matching.
