#!/usr/bin/env python3
"""
workflow_builder/build.py
Usage: python build.py <folder_path> [--output output.html] [--param KEY=VALUE ...]
"""
import re
import os
import sys
import json
import argparse
import pathlib
import html as html_mod
from collections import OrderedDict

PARAM_RE = re.compile(r'\{\{(\w+)(?:=([^}]*))?\}\}')

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def slugify(text, seen=None):
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    if seen is None:
        return slug
    base = slug
    count = 2
    while slug in seen:
        slug = '{}-{}'.format(base, count)
        count += 1
    seen.add(slug)
    return slug


def extract_params(text):
    """Return list of (name, default_or_empty) from {{NAME}} / {{NAME=default}} patterns."""
    return [(m.group(1), m.group(2) or '') for m in PARAM_RE.finditer(text)]


def parse_md_file(path):
    """Parse a single stage .md file into a Stage dict."""
    lines = pathlib.Path(path).read_text(encoding='utf-8').splitlines()

    stage_title = ''
    stage_desc_lines = []
    steps = []

    # parser state
    STATE_STAGE_DESC = 'stage_desc'
    STATE_STEP_BODY = 'step_body'
    STATE_CODE_BLOCK = 'code_block'

    state = STATE_STAGE_DESC
    current_step = None
    current_body_lines = []  # text lines in current step before a block
    current_code_lines = []
    current_code_lang = ''

    def flush_text(target_blocks, lines_buf):
        text = '\n'.join(lines_buf).strip()
        if text:
            target_blocks.append({'type': 'text', 'raw': text})
        lines_buf.clear()

    def flush_code(target_blocks, code_lines, lang):
        raw = '\n'.join(code_lines)
        target_blocks.append({'type': lang if lang == 'mermaid' else 'code',
                               'raw': raw, 'lang': lang})
        code_lines.clear()

    for line in lines:
        if state == STATE_STAGE_DESC:
            if line.startswith('# Stage:'):
                stage_title = line[len('# Stage:'):].strip()
            elif line.startswith('### '):
                # start first step
                if current_step is not None:
                    steps.append(current_step)
                flush_text([], stage_desc_lines)  # desc lines already collected
                current_step = {'title': line[4:].strip(), 'blocks': []}
                current_body_lines = []
                state = STATE_STEP_BODY
            else:
                stage_desc_lines.append(line)

        elif state == STATE_STEP_BODY:
            fence_match = re.match(r'^```(\w*)', line)
            if fence_match:
                flush_text(current_step['blocks'], current_body_lines)
                current_code_lang = fence_match.group(1).lower()
                current_code_lines = []
                state = STATE_CODE_BLOCK
            elif line.startswith('### '):
                flush_text(current_step['blocks'], current_body_lines)
                steps.append(current_step)
                current_step = {'title': line[4:].strip(), 'blocks': []}
                current_body_lines = []
            else:
                current_body_lines.append(line)

        elif state == STATE_CODE_BLOCK:
            if line.strip() == '```':
                flush_code(current_step['blocks'], current_code_lines, current_code_lang)
                state = STATE_STEP_BODY
            else:
                current_code_lines.append(line)

    # flush final step
    if current_step is not None:
        if state == STATE_STEP_BODY:
            flush_text(current_step['blocks'], current_body_lines)
        elif state == STATE_CODE_BLOCK:
            flush_code(current_step['blocks'], current_code_lines, current_code_lang)
        steps.append(current_step)

    desc_text = '\n'.join(stage_desc_lines).strip()
    return {
        'title': stage_title or pathlib.Path(path).stem,
        'description': desc_text,
        'steps': steps,
    }


def parse_folder(folder, cli_params):
    """Read all *.md files from folder (sorted), return WorkflowData dict."""
    folder = pathlib.Path(folder)
    md_files = sorted(folder.glob('*.md'))
    if not md_files:
        print('Warning: no .md files found in {}'.format(folder), file=sys.stderr)

    seen_ids = set()
    stages = []
    params = OrderedDict()

    for md_path in md_files:
        stage = parse_md_file(md_path)
        stage['id'] = slugify(stage['title'], seen_ids)

        # collect params from code blocks
        for step in stage['steps']:
            for block in step['blocks']:
                if block['type'] == 'code':
                    for name, default in extract_params(block['raw']):
                        if name not in params:
                            params[name] = default

        stages.append(stage)

    # CLI overrides
    for k, v in cli_params.items():
        params[k] = v

    return {'stages': stages, 'params': params}


# ---------------------------------------------------------------------------
# HTML rendering (Python side)
# ---------------------------------------------------------------------------

def escape(text):
    return html_mod.escape(text, quote=True)


def escape_preserving_params(text):
    """HTML-escape text but keep {{PARAM}} / {{PARAM=default}} placeholders intact."""
    # Split on param placeholders, escape the non-placeholder parts
    parts = PARAM_RE.split(text)
    # PARAM_RE has 2 groups so split gives: [before, name, default_or_None, after, ...]
    result = []
    i = 0
    last = 0
    for m in PARAM_RE.finditer(text):
        result.append(escape(text[last:m.start()]))
        # Reconstruct placeholder exactly as-is
        result.append(m.group(0))
        last = m.end()
    result.append(escape(text[last:]))
    return ''.join(result)


def render_text_block(raw):
    """Very lightweight inline-markdown: bold, inline code, paragraphs."""
    paragraphs = re.split(r'\n\n+', raw.strip())
    out = []
    for para in paragraphs:
        p = escape(para)
        p = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', p)
        p = re.sub(r'`(.+?)`', r'<code>\1</code>', p)
        out.append('<p>{}</p>'.format(p))
    return '\n'.join(out)


def render_stages_html(workflow):
    parts = []
    for stage in workflow['stages']:
        sid = stage['id']
        title_esc = escape(stage['title'])
        desc_html = render_text_block(stage['description']) if stage['description'] else ''

        steps_html = []
        for step in stage['steps']:
            step_title_esc = escape(step['title'])
            blocks_html = []
            for block in step['blocks']:
                if block['type'] == 'code':
                    raw_attr = escape_preserving_params(block['raw'])
                    display = escape_preserving_params(block['raw'])
                    blocks_html.append(
                        '<div class="code-block-wrap">'
                        '<button class="copy-btn" onclick="copyCode(this)">Copy</button>'
                        '<pre><code data-raw-command="{raw}">{display}</code></pre>'
                        '</div>'.format(raw=raw_attr, display=display)
                    )
                elif block['type'] == 'mermaid':
                    # NOT HTML-escaped — mermaid needs raw source
                    blocks_html.append(
                        '<div class="mermaid-wrap">'
                        '<div class="mermaid">{}</div>'
                        '</div>'.format(block['raw'])
                    )
                elif block['type'] == 'text':
                    blocks_html.append(render_text_block(block['raw']))

            steps_html.append(
                '<div class="step">'
                '<h3 class="step-title">{title}</h3>'
                '{blocks}'
                '</div>'.format(title=step_title_esc, blocks='\n'.join(blocks_html))
            )

        parts.append(
            '<section class="stage-section" id="{sid}">'
            '<h2 class="stage-title">{title}</h2>'
            '<div class="stage-desc">{desc}</div>'
            '{steps}'
            '<button class="mark-done-btn" data-stage="{sid}" onclick="toggleDone(this)">Mark Complete</button>'
            '</section>'.format(
                sid=sid, title=title_esc, desc=desc_html,
                steps='\n'.join(steps_html)
            )
        )

    return '\n'.join(parts)


# ---------------------------------------------------------------------------
# Template rendering
# ---------------------------------------------------------------------------

def render_html(workflow):
    stages_html = render_stages_html(workflow)
    workflow_json = json.dumps({
        'stages': [{'id': s['id'], 'title': s['title']} for s in workflow['stages']],
        'params': dict(workflow['params']),
    }, ensure_ascii=False)

    template_path = pathlib.Path(__file__).parent / 'template.html'

    try:
        import jinja2
        env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(template_path.parent)),
                                 autoescape=False)
        tmpl = env.get_template('template.html')
        return tmpl.render(stages_html=stages_html, workflow_json=workflow_json)
    except ImportError:
        pass

    # stdlib fallback: template.html uses exactly two markers
    template_src = template_path.read_text(encoding='utf-8')
    result = template_src.replace('STAGES_HTML_PLACEHOLDER', stages_html)
    result = result.replace('WORKFLOW_JSON_PLACEHOLDER', workflow_json)
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description='Convert a folder of Markdown stage files into a workflow HTML page.')
    ap.add_argument('folder', help='Folder containing *.md stage files')
    ap.add_argument('--output', default='output.html', help='Output HTML file path')
    ap.add_argument('--param', action='append', default=[], metavar='KEY=VALUE',
                    help='Pre-seed a parameter default, e.g. --param INPUT_DIR=C:\\data')
    args = ap.parse_args()

    cli_params = {}
    for p in args.param:
        k, _, v = p.partition('=')
        cli_params[k.strip()] = v.strip()

    folder = pathlib.Path(args.folder)
    if not folder.is_dir():
        print('Error: folder not found: {}'.format(folder), file=sys.stderr)
        sys.exit(1)

    workflow = parse_folder(folder, cli_params)
    html_content = render_html(workflow)

    out = pathlib.Path(args.output)
    out.write_text(html_content, encoding='utf-8')
    print('Written: {}'.format(out.resolve()))


if __name__ == '__main__':
    main()
