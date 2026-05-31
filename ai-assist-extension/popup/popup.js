/* popup.js — shows current tab's detected app and AI provider status */

(function () {
  'use strict';

  var APP_TITLES = {
    task_tracker: 'Task Tracker',
    checklist_builder: 'Checklist Builder',
    work_log: 'Work Log',
    prompt_builder: 'Prompt Builder',
    mind_map: 'Mind Map',
    text2md: 'Text to Markdown',
    world_clock: 'World Clock',
    json_yaml_tools: 'JSON/YAML Tools',
    diff_viewer: 'Diff Viewer',
    flow_builder: 'Flow Builder',
    text_to_flow: 'Text to Flow',
    workflow_diagram_builder: 'Workflow Diagram Builder',
    unknown: 'Unknown page'
  };

  var PROVIDER_LABELS = {
    gemini: 'Google Gemini',
    ollama: 'Ollama (local)',
    claude: 'Claude (Anthropic)',
    openai: 'OpenAI',
    mcp: 'MCP Server'
  };

  function init() {
    // Check if current tab is a file:// URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      var url = tab ? (tab.url || '') : '';
      var isFileUrl = url.startsWith('file://');

      if (!isFileUrl) {
        document.getElementById('status-label').textContent = 'Open a local HTML tool to use AI Assist';
        document.getElementById('status-dot').className = 'status-dot gray';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('app-name').textContent = 'Not a file:// page';
      } else {
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('app-name').textContent = guessAppFromUrl(url);
      }
    });

    // Check AI provider config
    chrome.storage.sync.get(['aiProvider', 'aiKey', 'ollamaUrl', 'ollamaModel', 'mcpUrl'], function (s) {
      var provider = s.aiProvider || 'gemini';
      var hasKey = (provider === 'ollama' && s.ollamaUrl) ||
                   (provider === 'mcp' && s.mcpUrl) ||
                   (s.aiKey && s.aiKey.trim().length > 10);

      var providerEl = document.getElementById('provider-status');
      providerEl.textContent = 'Provider: ' + (PROVIDER_LABELS[provider] || provider) + (hasKey ? ' ✓' : ' — not configured');

      if (!hasKey) {
        document.getElementById('no-key-section').style.display = 'block';
      }
    });

    document.getElementById('open-options').addEventListener('click', function () {
      chrome.runtime.openOptionsPage();
    });
  }

  function guessAppFromUrl(url) {
    var storageKeys = {
      'task_tracker': 'Task Tracker',
      'checklist_builder': 'Checklist Builder',
      'work_log': 'Work Log',
      'prompt_builder': 'Prompt Builder',
      'mind_map': 'Mind Map',
      'text2md': 'Text to Markdown',
      'world_clock': 'World Clock',
      'json_yaml_tools': 'JSON/YAML Tools',
      'diff_viewer': 'Diff Viewer',
      'flow_builder': 'Flow Builder',
      'text_to_flow': 'Text to Flow',
      'workflow_diagram_builder': 'Workflow Diagram Builder',
      'hub': 'Tools Hub'
    };

    for (var key in storageKeys) {
      if (url.toLowerCase().indexOf(key) !== -1) {
        return storageKeys[key];
      }
    }
    return 'HTML Tool';
  }

  init();

})();
