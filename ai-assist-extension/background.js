/* AI Assist — background.js (MV3 Service Worker)
 * Handles all AI API calls — keeps the API key isolated from page context.
 * Supports: Google Gemini, Ollama (local), Anthropic Claude, OpenAI, MCP HTTP server.
 */

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'AI_REQUEST') {
    handleAIRequest(msg.prompt).then(sendResponse).catch(function (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true; // keep channel open for async response
  }

  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (msg.type === 'TEST_CONNECTION') {
    testConnection(msg.settings).then(sendResponse).catch(function (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true;
  }
});

// ─── Main dispatcher ──────────────────────────────────────────────────────

async function handleAIRequest(prompt) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'gemini';

  switch (provider) {
    case 'gemini':   return callGemini(prompt, settings);
    case 'ollama':   return callOllama(prompt, settings);
    case 'claude':   return callClaude(prompt, settings);
    case 'openai':   return callOpenAI(prompt, settings);
    case 'mcp':      return callMCP(prompt, settings);
    default:
      throw new Error('Unknown AI provider: ' + provider + '. Please configure a provider in extension Options.');
  }
}

// ─── Settings helper ──────────────────────────────────────────────────────

function getSettings() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(
      ['aiProvider', 'aiKey', 'aiModel', 'ollamaUrl', 'ollamaModel', 'mcpUrl', 'mcpPort'],
      resolve
    );
  });
}

// ─── Google Gemini API ────────────────────────────────────────────────────
// Uses the OpenAI-compatible endpoint so the request body is the same as OpenAI.

async function callGemini(prompt, settings) {
  const key = settings.aiKey;
  if (!key || key.trim().length < 10) {
    throw new Error('Gemini API key not configured. Open extension Options to add your key.');
  }

  const model = settings.aiModel || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

  const body = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 2048,
    temperature: 0.3
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key.trim()
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Gemini API error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('Gemini returned an empty response.');
  return { ok: true, content: content.trim() };
}

// ─── Local Ollama ─────────────────────────────────────────────────────────
// Requires Ollama running with OLLAMA_ORIGINS=* (see README).

async function callOllama(prompt, settings) {
  const baseUrl = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const model = settings.ollamaModel || 'llama3.2';
  const url = baseUrl + '/api/chat';

  const body = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    stream: false,
    options: { temperature: 0.3 }
  };

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('Cannot connect to Ollama at ' + baseUrl + '. Make sure Ollama is running with OLLAMA_ORIGINS=* — see extension Options for instructions.');
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Ollama error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  const content = data.message && data.message.content;
  if (!content) throw new Error('Ollama returned an empty response.');
  return { ok: true, content: content.trim() };
}

// ─── Anthropic Claude API ─────────────────────────────────────────────────

async function callClaude(prompt, settings) {
  const key = settings.aiKey;
  if (!key || key.trim().length < 10) {
    throw new Error('Claude API key not configured. Open extension Options to add your key.');
  }

  const model = settings.aiModel || 'claude-haiku-4-5-20251001';
  const url = 'https://api.anthropic.com/v1/messages';

  const body = {
    model: model,
    max_tokens: 2048,
    messages: [
      { role: 'user', content: prompt }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key.trim(),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Claude API error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  const content = data.content && data.content[0] && data.content[0].text;
  if (!content) throw new Error('Claude returned an empty response.');
  return { ok: true, content: content.trim() };
}

// ─── OpenAI API ───────────────────────────────────────────────────────────

async function callOpenAI(prompt, settings) {
  const key = settings.aiKey;
  if (!key || key.trim().length < 10) {
    throw new Error('OpenAI API key not configured. Open extension Options to add your key.');
  }

  const model = settings.aiModel || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const body = {
    model: model,
    messages: [
      { role: 'system', content: 'You are a helpful productivity assistant. Be concise and practical.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2048,
    temperature: 0.3
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key.trim()
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('OpenAI error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('OpenAI returned an empty response.');
  return { ok: true, content: content.trim() };
}

// ─── MCP HTTP Server ──────────────────────────────────────────────────────
// For users running a local MCP server that proxies to any AI backend.

async function callMCP(prompt, settings) {
  const port = settings.mcpPort || 8000;
  const baseUrl = settings.mcpUrl || ('http://localhost:' + port);
  const url = baseUrl.replace(/\/$/, '') + '/prompt';

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, max_tokens: 2048 })
    });
  } catch (e) {
    throw new Error('Cannot connect to MCP server at ' + baseUrl + '. Make sure your MCP server is running.');
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('MCP server error ' + resp.status + ': ' + errText.slice(0, 200));
  }

  const data = await resp.json();
  // MCP servers vary — try common response shapes
  const content = data.content || data.text || data.response || data.result || data.message || JSON.stringify(data);
  return { ok: true, content: String(content).trim() };
}

// ─── Connection test (called from Options page) ────────────────────────────

async function testConnection(settings) {
  const testPrompt = 'Reply with exactly: OK';
  try {
    const provider = settings.aiProvider || 'gemini';
    let result;
    switch (provider) {
      case 'gemini': result = await callGemini(testPrompt, settings); break;
      case 'ollama': result = await callOllama(testPrompt, settings); break;
      case 'claude': result = await callClaude(testPrompt, settings); break;
      case 'openai': result = await callOpenAI(testPrompt, settings); break;
      case 'mcp':    result = await callMCP(testPrompt, settings); break;
      default: throw new Error('Unknown provider');
    }
    return { ok: true, content: 'Connection successful! Response: ' + result.content.slice(0, 60) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
