"""
md2html.py — Convert a folder of .md files into:
  1. output/index.html  — single-page HTML with client-side search
  2. output/llm.txt     — combined raw markdown for LLM ingestion
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def collect_md_files(input_dir: Path) -> List[Path]:
    return sorted(input_dir.glob("*.md"))


def build_llm_txt(md_files: List[Path]) -> str:
    lines = [
        "# LLM Standards Document",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Sources: {len(md_files)} file(s)",
        "",
    ]
    for path in md_files:
        lines += [
            "---",
            f"## {path.stem}",
            "",
            path.read_text(encoding="utf-8").strip(),
            "",
        ]
    lines += [
        "---",
        f"Total files: {len(md_files)}",
        f"Total words: {sum(len(p.read_text(encoding='utf-8').split()) for p in md_files)}",
    ]
    return "\n".join(lines)


def render_html_page(md_files: List[Path]) -> str:
    # Build per-section data for Python side (id, title, raw md)
    sections = []
    for path in md_files:
        content = path.read_text(encoding="utf-8")
        # Extract first heading or use filename as title
        title_match = re.search(r"^#{1,3}\s+(.+)", content, re.MULTILINE)
        title = title_match.group(1) if title_match else path.stem
        sections.append(
            {"id": slugify(path.stem), "title": title, "filename": path.name, "md": content}
        )

    # Embed raw markdown safely inside JS template literals using JSON encoding
    sections_json = json.dumps(sections, ensure_ascii=False)

    nav_links = "\n".join(
        f'<a href="#{s["id"]}">{s["title"]}</a>' for s in sections
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Documentation</title>
<script src="https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js"></script>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  :root {{
    --nav-w: 240px;
    --header-h: 56px;
    --accent: #2563eb;
    --bg: #f8fafc;
    --card: #ffffff;
    --text: #1e293b;
    --muted: #64748b;
    --border: #e2e8f0;
    --mark: #fef08a;
  }}
  body {{ font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }}

  /* Header */
  header {{
    position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
    background: var(--card); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px; padding: 0 16px; z-index: 100;
  }}
  header h1 {{ font-size: 1rem; font-weight: 600; white-space: nowrap; color: var(--accent); }}
  #search-wrap {{ flex: 1; position: relative; max-width: 480px; }}
  #search {{
    width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px;
    font-size: 0.9rem; outline: none; background: var(--bg);
  }}
  #search:focus {{ border-color: var(--accent); }}
  #results {{
    display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: var(--card); border: 1px solid var(--border); border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,.1); max-height: 360px; overflow-y: auto; z-index: 200;
  }}
  .result-item {{
    padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
  }}
  .result-item:last-child {{ border-bottom: none; }}
  .result-item:hover {{ background: var(--bg); }}
  .result-item strong {{ color: var(--accent); display: block; margin-bottom: 2px; }}
  .result-item span {{ color: var(--muted); }}
  #no-results {{ padding: 12px 14px; color: var(--muted); font-size: 0.85rem; }}

  /* Nav */
  nav {{
    position: fixed; top: var(--header-h); left: 0; width: var(--nav-w);
    height: calc(100vh - var(--header-h)); overflow-y: auto;
    border-right: 1px solid var(--border); background: var(--card); padding: 16px 0;
  }}
  nav a {{
    display: block; padding: 7px 20px; font-size: 0.85rem; color: var(--muted);
    text-decoration: none; border-left: 3px solid transparent; transition: all .15s;
  }}
  nav a:hover, nav a.active {{ color: var(--accent); border-left-color: var(--accent); background: var(--bg); }}

  /* Main */
  main {{
    margin-left: var(--nav-w); padding-top: calc(var(--header-h) + 32px);
    padding-bottom: 80px; padding-left: 48px; padding-right: 48px; max-width: 900px;
  }}
  section {{ margin-bottom: 64px; scroll-margin-top: 72px; }}
  .section-label {{
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
    color: var(--muted); margin-bottom: 12px;
  }}

  /* Markdown rendered content */
  .md-body h1,h2,h3,h4 {{ margin: 1.2em 0 .5em; line-height: 1.3; }}
  .md-body h1 {{ font-size: 1.8rem; border-bottom: 1px solid var(--border); padding-bottom: .3em; }}
  .md-body h2 {{ font-size: 1.3rem; }}
  .md-body h3 {{ font-size: 1.1rem; }}
  .md-body p {{ margin: .75em 0; line-height: 1.7; }}
  .md-body ul, .md-body ol {{ margin: .75em 0 .75em 1.5em; }}
  .md-body li {{ margin: .3em 0; line-height: 1.6; }}
  .md-body code {{
    background: #f1f5f9; border: 1px solid var(--border); border-radius: 4px;
    padding: 1px 5px; font-size: .85em; font-family: "Fira Code", monospace;
  }}
  .md-body pre {{
    background: #1e293b; color: #e2e8f0; border-radius: 8px;
    padding: 16px; overflow-x: auto; margin: 1em 0;
  }}
  .md-body pre code {{ background: none; border: none; color: inherit; padding: 0; font-size: .88em; }}
  .md-body blockquote {{
    border-left: 4px solid var(--accent); padding: 8px 16px; margin: 1em 0;
    color: var(--muted); background: #f1f5f9; border-radius: 0 6px 6px 0;
  }}
  .md-body table {{ border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .9em; }}
  .md-body th, .md-body td {{ border: 1px solid var(--border); padding: 8px 12px; text-align: left; }}
  .md-body th {{ background: var(--bg); font-weight: 600; }}
  .md-body a {{ color: var(--accent); }}
  .md-body hr {{ border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }}

  mark {{ background: var(--mark); border-radius: 2px; padding: 0 1px; }}

  @media (max-width: 720px) {{
    nav {{ display: none; }}
    main {{ margin-left: 0; padding-left: 16px; padding-right: 16px; }}
  }}
</style>
</head>
<body>

<header>
  <h1>Docs</h1>
  <div id="search-wrap">
    <input id="search" type="search" placeholder="Search documentation..." autocomplete="off">
    <div id="results"></div>
  </div>
</header>

<nav>
{nav_links}
</nav>

<main id="main-content">
</main>

<script>
const SECTIONS = {sections_json};

const md = window.markdownit({{ html: false, linkify: true, typographer: true }});

// Create section shells immediately (no markdown rendering yet)
const main = document.getElementById('main-content');
const sectionEls = {{}};
SECTIONS.forEach((s, i) => {{
  const sec = document.createElement('section');
  sec.id = s.id;
  sec.dataset.rendered = '0';
  sec.innerHTML = `<div class="section-label">${{s.filename}}</div><div class="md-body"></div>`;
  main.appendChild(sec);
  sectionEls[s.id] = sec;

  // Render first section immediately so the page isn't blank on load
  if (i === 0) {{
    sec.querySelector('.md-body').innerHTML = md.render(s.md);
    sec.dataset.rendered = '1';
  }}
}});

// Lazy-render remaining sections as they approach the viewport
const renderObserver = new IntersectionObserver((entries) => {{
  entries.forEach(entry => {{
    if (entry.isIntersecting && entry.target.dataset.rendered === '0') {{
      const s = SECTIONS.find(x => x.id === entry.target.id);
      if (s) {{
        entry.target.querySelector('.md-body').innerHTML = md.render(s.md);
        entry.target.dataset.rendered = '1';
      }}
    }}
  }});
}}, {{ rootMargin: '200px' }});
document.querySelectorAll('section').forEach(s => renderObserver.observe(s));

// Build plain-text search index (raw markdown, no DOM involvement)
const index = SECTIONS.map(s => ({{
  id: s.id,
  title: s.title,
  filename: s.filename,
  text: s.md,
}}));

// Search
const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');

let highlightTimeout = null;
let searchDebounce = null;

function clearHighlights() {{
  document.querySelectorAll('mark.search-hl').forEach(m => {{
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  }});
}}

function highlight(sectionId, term) {{
  clearTimeout(highlightTimeout);
  clearHighlights();
  const section = document.getElementById(sectionId);
  if (!section) return;
  const body = section.querySelector('.md-body');
  if (!body || !term) return;

  const walk = (node) => {{
    if (node.nodeType === 3) {{
      const idx = node.textContent.toLowerCase().indexOf(term.toLowerCase());
      if (idx === -1) return;
      const before = node.textContent.slice(0, idx);
      const match = node.textContent.slice(idx, idx + term.length);
      const after = node.textContent.slice(idx + term.length);
      const mark = document.createElement('mark');
      mark.className = 'search-hl';
      mark.textContent = match;
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
    }} else if (node.nodeType === 1 && !['SCRIPT','STYLE'].includes(node.tagName)) {{
      // iterate children snapshot to avoid live mutation issues
      [...node.childNodes].forEach(walk);
    }}
  }};
  walk(body);

  highlightTimeout = setTimeout(clearHighlights, 4000);
}}

searchEl.addEventListener('input', () => {{
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(searchEl.value.trim()), 150);
}});

function runSearch(q) {{
  if (q.length < 2) {{ resultsEl.style.display = 'none'; return; }}

  const matches = [];
  index.forEach(item => {{
    const idx = item.text.toLowerCase().indexOf(q.toLowerCase());
    if (idx !== -1) {{
      const snippet = item.text.slice(Math.max(0, idx - 20), idx + 80).replace(/\\n/g, ' ');
      matches.push({{ id: item.id, title: item.title, filename: item.filename, snippet, term: q }});
    }}
  }});

  if (matches.length === 0) {{
    resultsEl.innerHTML = '<div id="no-results">No results found.</div>';
  }} else {{
    resultsEl.innerHTML = matches.map(m => `
      <div class="result-item" data-id="${{m.id}}" data-term="${{m.term.replace(/"/g,'&quot;')}}">
        <strong>${{m.title}}</strong>
        <span>…${{m.snippet}}…</span>
      </div>`).join('');
    resultsEl.querySelectorAll('.result-item').forEach(el => {{
      el.addEventListener('click', () => {{
        resultsEl.style.display = 'none';
        searchEl.value = '';
        const id = el.dataset.id;
        const term = el.dataset.term;
        const section = document.getElementById(id);
        if (!section) return;
        // Force render if not yet visible (lazy render may not have fired)
        if (section.dataset.rendered === '0') {{
          const s = SECTIONS.find(x => x.id === id);
          if (s) {{
            section.querySelector('.md-body').innerHTML = md.render(s.md);
            section.dataset.rendered = '1';
          }}
        }}
        highlight(id, term);
        const mark = section.querySelector('mark.search-hl');
        const scrollTarget = mark || section;
        const headerH = document.querySelector('header').offsetHeight;
        const top = scrollTarget.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo(0, top);
      }});
    }});
  }}
  resultsEl.style.display = 'block';
}}

document.addEventListener('click', e => {{
  if (!e.target.closest('#search-wrap')) resultsEl.style.display = 'none';
}});

// Active nav highlight on scroll
const navLinks = document.querySelectorAll('nav a');
const observer = new IntersectionObserver(entries => {{
  entries.forEach(entry => {{
    if (entry.isIntersecting) {{
      navLinks.forEach(a => a.classList.remove('active'));
      const link = document.querySelector(`nav a[href="#${{entry.target.id}}"]`);
      if (link) link.classList.add('active');
    }}
  }});
}}, {{ rootMargin: '-20% 0px -70% 0px' }});
document.querySelectorAll('section').forEach(s => observer.observe(s));
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description="Convert .md files to searchable HTML + llm.txt")
    parser.add_argument("--input", default="./sample_input", help="Folder containing .md files")
    parser.add_argument("--output", default="./output", help="Output folder")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"Input folder not found: {input_dir}")
        return

    md_files = collect_md_files(input_dir)
    if not md_files:
        print(f"No .md files found in {input_dir}")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    html = render_html_page(md_files)
    (output_dir / "index.html").write_text(html, encoding="utf-8")
    print(f"Written: {output_dir / 'index.html'}")

    llm = build_llm_txt(md_files)
    (output_dir / "llm.txt").write_text(llm, encoding="utf-8")
    print(f"Written: {output_dir / 'llm.txt'}")

    print(f"\nProcessed {len(md_files)} file(s): {[f.name for f in md_files]}")


if __name__ == "__main__":
    main()
