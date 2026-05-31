/* options.js — handles saving/loading settings and testing the AI connection */

(function () {
  'use strict';

  var currentProvider = 'gemini';

  var providerKeyMap = {
    gemini: 'gemini-key',
    claude: 'claude-key',
    openai: 'openai-key'
  };

  // ── Load saved settings into the form ──

  function loadSettings() {
    chrome.storage.sync.get(
      ['aiProvider', 'aiKey', 'aiModel', 'ollamaUrl', 'ollamaModel', 'mcpUrl'],
      function (s) {
        var provider = s.aiProvider || 'gemini';
        switchProvider(provider);

        if (provider === 'gemini') {
          if (s.aiKey) document.getElementById('gemini-key').value = s.aiKey;
          var gm = document.getElementById('gemini-model');
          if (s.aiModel && gm) setSelectValue(gm, s.aiModel);
        } else if (provider === 'ollama') {
          if (s.ollamaUrl) document.getElementById('ollama-url').value = s.ollamaUrl;
          if (s.ollamaModel) document.getElementById('ollama-model').value = s.ollamaModel;
        } else if (provider === 'claude') {
          if (s.aiKey) document.getElementById('claude-key').value = s.aiKey;
          var cm = document.getElementById('claude-model');
          if (s.aiModel && cm) setSelectValue(cm, s.aiModel);
        } else if (provider === 'openai') {
          if (s.aiKey) document.getElementById('openai-key').value = s.aiKey;
          var om = document.getElementById('openai-model');
          if (s.aiModel && om) setSelectValue(om, s.aiModel);
        } else if (provider === 'mcp') {
          if (s.mcpUrl) document.getElementById('mcp-url').value = s.mcpUrl;
        }
      }
    );
  }

  function setSelectValue(selectEl, value) {
    for (var i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === value) {
        selectEl.selectedIndex = i;
        break;
      }
    }
  }

  // ── Switch provider tab ──

  function switchProvider(provider) {
    currentProvider = provider;

    document.querySelectorAll('.provider-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-provider') === provider);
    });
    document.querySelectorAll('.section').forEach(function (sec) {
      sec.classList.remove('active');
    });
    var activeSection = document.getElementById('section-' + provider);
    if (activeSection) activeSection.classList.add('active');

    hideStatus();
  }

  // ── Collect current settings from the form ──

  function collectSettings() {
    var settings = { aiProvider: currentProvider };

    if (currentProvider === 'gemini') {
      settings.aiKey = document.getElementById('gemini-key').value.trim();
      settings.aiModel = document.getElementById('gemini-model').value;
    } else if (currentProvider === 'ollama') {
      settings.ollamaUrl = document.getElementById('ollama-url').value.trim() || 'http://localhost:11434';
      settings.ollamaModel = document.getElementById('ollama-model').value.trim() || 'llama3.2';
      settings.aiKey = '';
    } else if (currentProvider === 'claude') {
      settings.aiKey = document.getElementById('claude-key').value.trim();
      settings.aiModel = document.getElementById('claude-model').value;
    } else if (currentProvider === 'openai') {
      settings.aiKey = document.getElementById('openai-key').value.trim();
      settings.aiModel = document.getElementById('openai-model').value;
    } else if (currentProvider === 'mcp') {
      settings.mcpUrl = document.getElementById('mcp-url').value.trim() || 'http://localhost:8000';
      settings.aiKey = '';
    }

    return settings;
  }

  // ── Save ──

  document.getElementById('save-btn').addEventListener('click', function () {
    var settings = collectSettings();
    chrome.storage.sync.set(settings, function () {
      showStatus('Settings saved!', 'ok');
    });
  });

  // ── Test connection ──

  document.getElementById('test-btn').addEventListener('click', function () {
    var settings = collectSettings();
    showStatus('Testing connection…', 'ok');

    chrome.runtime.sendMessage(
      { type: 'TEST_CONNECTION', settings: settings },
      function (response) {
        if (chrome.runtime.lastError) {
          showStatus('Extension error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.ok) {
          showStatus('✓ ' + response.content, 'ok');
        } else {
          showStatus('✗ ' + (response ? response.error : 'Unknown error'), 'error');
        }
      }
    );
  });

  // ── Provider tab clicks ──

  document.querySelectorAll('.provider-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchProvider(tab.getAttribute('data-provider'));
    });
  });

  // ── Status helpers ──

  function showStatus(msg, type) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = type;
    el.style.display = 'block';
  }

  function hideStatus() {
    var el = document.getElementById('status');
    el.style.display = 'none';
    el.className = '';
  }

  // ── Init ──
  loadSettings();

})();
