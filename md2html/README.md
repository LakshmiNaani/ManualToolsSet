# md2html

Converts a folder of Markdown files into two outputs:

- **`index.html`** — a single-page, searchable documentation site
- **`llm.txt`** — all Markdown combined into one file for LLM ingestion

---

## Usage

```bash
python md2html.py --input <input_folder> --output <output_folder>
```

**Defaults** (if flags are omitted):

```bash
python md2html.py
# reads from ./sample_input, writes to ./output
```

**Custom paths:**

```bash
python md2html.py --input ./docs --output ./dist
```

**Arguments:**

| Argument | Default | Description |
|----------|---------|-------------|
| `--input` | `./sample_input` | Folder containing `.md` files |
| `--output` | `./output` | Folder where outputs are written |

---

## Outputs

### `index.html`

Open directly in any browser — no server needed.

- All `.md` files are rendered and embedded in one page
- Each file becomes a `<section>` with a sidebar nav link
- The search bar (top of page) matches text across all sections
- Clicking a search result scrolls to the match and highlights it

### `llm.txt`

Plain text file combining all source `.md` files, separated by `---` dividers. Includes a header with the generation date, source file list, and a footer with word and file counts. Paste directly into an LLM context window.

---

## llm.txt — Rules and Standards

`llm.txt` plays the same role as `robots.txt` does for web crawlers — it is a machine-readable, structured entry point for LLMs to understand the full content of a documentation set without needing to parse HTML or navigate a site. The format is intentionally plain text (raw Markdown, not rendered HTML) so that any LLM can read it with no preprocessing.

### Current structure

```
# LLM Standards Document          ← document-level title
Generated: YYYY-MM-DD HH:MM       ← timestamp of generation
Sources: N file(s)                 ← count of source .md files

---                                ← section divider
## <filename without extension>    ← heading per source file
                                   ← blank line
<raw markdown content>             ← full content, whitespace-stripped

---                                ← closing divider
Total files: N                     ← footer metadata
Total words: N
```

### Rules currently applied

| Rule | What it does |
|------|-------------|
| Sort order | Files are included alphabetically (driven by `collect_md_files` → `sorted()`) |
| Raw markdown | Content is kept as-is — no HTML conversion, no stripping of syntax |
| Whitespace | Leading/trailing whitespace stripped from each file with `.strip()` |
| Dividers | Each file is preceded by `---` so parsers can split on section boundaries |
| File heading | `## <stem>` uses the filename without extension as the section label |
| Header block | Title, generation timestamp, and source count appear before any content |
| Footer block | Total file count and total word count appear after all content |

### Where to make changes — `build_llm_txt()` in `md2html.py`

All rules for `llm.txt` live exclusively in the `build_llm_txt()` function. Nothing outside that function affects this file.

**To change the document title or header fields:**
Edit the opening `lines = [...]` list. Add, remove, or reorder any of the header lines there.

**To change what appears per file (heading format, extra metadata, order):**
Edit the `lines += [...]` block inside the `for path in md_files:` loop. For example:
- Add `f"Source: {path.name}"` to include the full filename with extension
- Add `f"Words: {len(content.split())}"` per file to show per-file word counts
- Replace `path.stem` with a title extracted from the first `#` heading for a friendlier label

**To change sort order:**
Modify `collect_md_files()` — change `sorted()` to `sorted(..., reverse=True)` for reverse order, or replace it with a custom sort key (e.g. sort by file modification time).

**To exclude certain files:**
Add a filter in `collect_md_files()` or at the top of `build_llm_txt()`:
```python
md_files = [f for f in md_files if not f.name.startswith('_')]
```

**To change the footer:**
Edit the closing `lines += [...]` block after the loop. Add any summary statistics or closing instructions for the LLM there.

**To add LLM-specific directives** (analogous to `robots.txt` directives):
Add them to the header block, e.g.:
```python
"Context: Use this document to answer questions about team standards.",
"Scope: Internal engineering documentation only.",
```

---

## Coding Approach

The script is a single file with no third-party Python dependencies — only the standard library (`pathlib`, `argparse`, `json`, `re`, `datetime`).

### Structure

```
main()
  └── collect_md_files()      # glob *.md, return sorted list
  └── render_html_page()      # build the full HTML string
  │     └── slugify()         # filename → safe CSS id
  └── build_llm_txt()         # combine raw markdown with dividers
```

### How the HTML is built

Rather than a template engine, the HTML is an inline Python f-string. This keeps the script self-contained and makes the template easy to read and edit alongside the logic.

The raw Markdown content is serialised to JSON and embedded directly in the page as a JavaScript array. On load, the browser renders it with [`markdown-it`](https://github.com/markdown-it/markdown-it) (loaded from CDN). This means:

- No Python Markdown library needed
- The rendered HTML is always current with the CDN's renderer
- The same JSON data powers both the rendered view and the search index

### How search works

On each keystroke, a 150 ms debounce timer resets. When the user pauses typing, the search runs once against the in-memory index (built from raw Markdown text, not the DOM). Results show the filename and a ~80-character snippet around the match.

On click, the order of operations matters:

1. **Force-render the section** — sections are lazy-rendered (see below), so if the target hasn't scrolled into view yet it gets rendered now before anything else
2. **Highlight first** — a DOM walk finds the first text node containing the term inside the target section and wraps it in a `<mark class="search-hl">` element
3. **Scroll to the mark** — `getBoundingClientRect()` is called on the inserted `<mark>` (not the section top), giving the exact pixel position of the matched word; `window.scrollTo(0, top)` lands there with the fixed header offset subtracted
4. **Highlight clears** automatically after 4 seconds

The key insight is scrolling to the `<mark>` rather than the section top. A section can be long — scrolling to its heading would leave the matched text off-screen. By inserting the mark first and then measuring its position, the matched word always appears just below the header when you land.

### Performance for large files (20 MB+)

Two optimisations keep the page responsive at scale:

**Debounced search** — the search listener waits 150 ms after the last keystroke before scanning the index. This prevents a full linear scan on every character typed and makes even slow searches feel instant while typing.

**Lazy rendering** — on page load, only the first section is rendered by `markdown-it`. The remaining sections are shell `<div>`s with no HTML content yet. An `IntersectionObserver` with a 200 px root margin watches each shell; as the user scrolls toward a section, it renders just before it enters the viewport. This means a 20 MB file loads and becomes interactive in milliseconds — the browser only does work for what the user actually reads. If a search result targets an unrendered section, it is force-rendered synchronously before highlight and scroll run.

No indexing library, no server — everything runs in the browser with plain JavaScript.
