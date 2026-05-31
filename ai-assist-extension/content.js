/* AI Assist — content.js
 * Injected into every file:// page.
 * Creates a shadow DOM floating panel, detects which ManualToolsSet app is open,
 * reads localStorage data, sends AI requests via background.js, and writes back results.
 */

(function () {
  'use strict';

  // ─── App detection config ─────────────────────────────────────────────────

  var APP_CONFIGS = [
    {
      id: 'task_tracker',
      storageKey: 'task_tracker_v1',
      title: 'Task Tracker',
      features: [
        { id: 'analyze',      label: 'Analyze Tasks',  needsInput: false },
        { id: 'suggest-tags', label: 'Auto-Tag',        needsInput: false },
        { id: 'add-task',     label: 'Draft a Task',    needsInput: true,  placeholder: 'Describe the task...' },
        { id: 'prioritize',   label: 'Fix Priorities',  needsInput: false }
      ]
    },
    {
      id: 'checklist_builder',
      storageKey: 'checklist_builder_v1',
      title: 'Checklist Builder',
      features: [
        { id: 'expand-section',    label: 'Expand Section',    needsInput: true,  placeholder: 'Section name to expand...' },
        { id: 'generate-checklist',label: 'Generate Checklist', needsInput: true,  placeholder: 'Topic or goal...' }
      ]
    },
    {
      id: 'work_log',
      storageKey: 'work_log_v1',
      title: 'WorkLog',
      features: [
        { id: 'summarize',     label: 'Daily Summary',  needsInput: false },
        { id: 'weekly-report', label: 'Weekly Report',  needsInput: false },
        { id: 'suggest-entry', label: 'Log an Entry',   needsInput: true,  placeholder: 'What did you work on?' }
      ]
    },
    {
      id: 'prompt_builder',
      storageKey: 'pb_roles',
      title: 'PromptBuilder',
      features: [
        { id: 'improve-prompt', label: 'Improve Role',    needsInput: false },
        { id: 'test-prompts',   label: 'Test Prompts',    needsInput: false },
        { id: 'suggest-role',   label: 'Suggest a Role',  needsInput: true,  placeholder: 'What should this role do?' }
      ]
    },
    {
      id: 'mind_map',
      storageKey: 'mind_map_v1',
      title: 'Mind Map',
      features: [
        { id: 'expand-node',        label: 'Expand Node',     needsInput: true,  placeholder: 'Node text to expand...' },
        { id: 'suggest-connections',label: 'Find Connections', needsInput: false },
        { id: 'summarize-map',      label: 'Summarize Map',   needsInput: false }
      ]
    },
    {
      id: 'text2md',
      storageKey: 'text2md_state',
      title: 'Text2MD',
      features: [
        { id: 'improve-section',  label: 'Improve Section',   needsInput: true,  placeholder: 'Section heading to improve...' },
        { id: 'generate-outline', label: 'Generate Outline',  needsInput: true,  placeholder: 'Document topic...' }
      ]
    },
    {
      id: 'world_clock',
      storageKey: 'world_clock_v1',
      title: 'World Clock',
      features: [
        { id: 'suggest-zones',  label: 'Suggest Zones',   needsInput: true,  placeholder: 'Team locations (e.g. London, Tokyo)...' },
        { id: 'meeting-time',   label: 'Best Meeting Time',needsInput: false }
      ]
    },
    { id: 'json_yaml_tools',          storageKey: null, title: 'JSON',          titleMatch: 'JSON',     features: [{ id: 'explain', label: 'Explain', needsInput: false }, { id: 'fix-schema', label: 'Fix Schema', needsInput: false }] },
    { id: 'diff_viewer',              storageKey: null, title: 'Diff Viewer',   titleMatch: 'Diff',     features: [{ id: 'explain-diff', label: 'Explain Diff', needsInput: false }] },
    { id: 'flow_builder',             storageKey: null, title: 'Flow Builder',  titleMatch: 'Flow',     features: [{ id: 'suggest-steps', label: 'Suggest Steps', needsInput: true, placeholder: 'Describe your flow...' }] },
    { id: 'text_to_flow',             storageKey: null, title: 'Text to Flow',  titleMatch: 'Text to',  features: [{ id: 'improve-input', label: 'Improve Input', needsInput: false }] },
    { id: 'workflow_diagram_builder', storageKey: null, title: 'Workflow',      titleMatch: 'Workflow', features: [{ id: 'suggest-stages', label: 'Suggest Stages', needsInput: true, placeholder: 'Describe your workflow...' }] }
  ];

  // ─── Detect which app this page is ────────────────────────────────────────

  function detectApp() {
    for (var i = 0; i < APP_CONFIGS.length; i++) {
      var cfg = APP_CONFIGS[i];
      if (cfg.storageKey && localStorage.getItem(cfg.storageKey) !== null) {
        return cfg;
      }
    }
    var t = document.title.trim();
    for (var j = 0; j < APP_CONFIGS.length; j++) {
      var c = APP_CONFIGS[j];
      var match = c.titleMatch || c.title;
      if (match && t.toLowerCase().indexOf(match.toLowerCase()) !== -1) {
        return c;
      }
    }
    return { id: 'unknown', storageKey: null, title: t || 'This Page', features: [{ id: 'selection-assist', label: 'Ask About Selection', needsInput: true, placeholder: 'Ask a question about the selected text...' }] };
  }

  // ─── Read app data from localStorage ──────────────────────────────────────

  function readAppData(appConfig) {
    try {
      if (appConfig.id === 'prompt_builder') {
        return {
          roles: JSON.parse(localStorage.getItem('pb_roles') || '[]'),
          plans: JSON.parse(localStorage.getItem('pb_plans') || '[]'),
          activeRoleId: localStorage.getItem('pb_active_role_id'),
          contextFlags: JSON.parse(localStorage.getItem('pb_context_flags') || '{}'),
          selectedPlanIds: JSON.parse(localStorage.getItem('pb_selected_plan_ids') || '[]')
        };
      }
      if (appConfig.storageKey) {
        var raw = localStorage.getItem(appConfig.storageKey);
        return raw ? JSON.parse(raw) : null;
      }
      var sel = window.getSelection ? window.getSelection().toString() : '';
      return { selectedText: sel };
    } catch (e) {
      return null;
    }
  }

  // ─── Build prompts per feature ─────────────────────────────────────────────

  function buildPrompt(appId, featureId, data, userInput) {
    var today = new Date().toISOString().slice(0, 10);

    if (appId === 'task_tracker' && data && data.tasks) {
      var tasks = data.tasks;
      var taskLines = tasks.map(function (t) {
        return '[' + t.id + '] ' + t.title +
          ' | ' + (t.priority || 'medium') +
          ' | ' + (t.status || 'todo') +
          ' | due:' + (t.dueDate || 'none') +
          ' | tags:' + ((t.tags || []).join(',') || 'none');
      }).join('\n');
      var nonDone = tasks.filter(function (t) { return t.status !== 'done'; });
      var nonDoneLines = nonDone.map(function (t) {
        return '[' + t.id + '] ' + t.title + ' | ' + (t.priority || 'medium') + ' | due:' + (t.dueDate || 'none') + ' | tags:' + ((t.tags || []).join(',') || 'none');
      }).join('\n');
      var allTags = [];
      tasks.forEach(function (t) { (t.tags || []).forEach(function (tag) { if (allTags.indexOf(tag) === -1) allTags.push(tag); }); });

      if (featureId === 'analyze') {
        return 'You are a productivity assistant. Today is ' + today + '.\n\nHere are the active tasks:\n' + nonDoneLines + '\n\nProvide:\n1. A 2-sentence summary of what the user is focused on\n2. Top 3 risks or gaps (bullet points)\n3. Top 3 recommended next actions (bullet points)\n\nBe concise and practical.';
      }
      if (featureId === 'suggest-tags') {
        var untagged = tasks.filter(function (t) { return !t.tags || t.tags.length === 0; });
        if (untagged.length === 0) return 'All tasks already have tags. Nothing to suggest.';
        var untaggedLines = untagged.map(function (t) { return '[' + t.id + '] ' + t.title + (t.notes ? ' — ' + t.notes.slice(0, 80) : ''); }).join('\n');
        return 'You are a task management assistant. Existing tags in use: ' + allTags.join(', ') + '\n\nSuggest 2-3 tags for each untagged task. Reuse existing tags where possible.\n\nTasks:\n' + untaggedLines + '\n\nRespond ONLY with valid JSON array:\n[{"id":"task_id","tags":["tag1","tag2"]}]\n\nNo explanation, no markdown fences.';
      }
      if (featureId === 'add-task') {
        return 'You are a task management assistant. Today is ' + today + '.\n\nThe user wants to add a task described as:\n"' + userInput + '"\n\nExisting categories: immediate, this_week, next_week, this_month\nExisting frequencies: daily, weekly, monthly, yearly, upcoming_event\nExisting tags: ' + allTags.join(', ') + '\n\nGenerate a well-structured task. Respond ONLY with valid JSON (no markdown fences):\n{"title":"...","notes":"...","priority":"high|medium|low","status":"todo","category":"...","frequency":"weekly","tags":["..."],"assignee":""}';
      }
      if (featureId === 'prioritize') {
        var overdue = nonDone.filter(function (t) { return t.dueDate && t.dueDate < today; });
        if (overdue.length === 0) return 'No overdue tasks found. Priorities look fine.';
        var overdueLines = overdue.map(function (t) { return '[' + t.id + '] ' + t.title + ' | current priority: ' + (t.priority || 'medium') + ' | due: ' + t.dueDate; }).join('\n');
        return 'You are a task management assistant. Today is ' + today + '.\n\nThese tasks are overdue:\n' + overdueLines + '\n\nRecommend priority adjustments. Respond ONLY with valid JSON (no markdown fences):\n[{"id":"...","priority":"high|medium|low","reason":"one sentence"}]';
      }
    }

    if (appId === 'checklist_builder' && data && data.sections) {
      var sections = data.sections;
      if (featureId === 'expand-section') {
        var targetName = userInput || (sections[0] && sections[0].name) || 'section';
        var targetSection = sections.find(function (s) { return s.name.toLowerCase().indexOf(targetName.toLowerCase()) !== -1; }) || sections[0];
        var existing = targetSection ? (targetSection.items || []).map(function (i) { return '- ' + i.text; }).join('\n') : '';
        return 'You are a checklist assistant.\n\nSection: "' + targetName + '"\nExisting items:\n' + (existing || '(none)') + '\n\nAdd 5 new checklist items for this section that are not already listed. Be specific and actionable.\n\nRespond ONLY with a JSON array of strings (no markdown fences):\n["item 1","item 2","item 3","item 4","item 5"]';
      }
      if (featureId === 'generate-checklist') {
        return 'You are a checklist assistant.\n\nCreate a comprehensive checklist for: "' + userInput + '"\n\nRespond ONLY with valid JSON (no markdown fences):\n{"sections":[{"name":"Section Name","items":[{"text":"checklist item"}]}]}\n\n3-5 sections, 4-6 items each.';
      }
    }

    if (appId === 'work_log' && data && data.entries) {
      var entries = data.entries || [];
      if (featureId === 'summarize') {
        var todayEntries = entries.filter(function (e) { return e.at && e.at.slice(0, 10) === today; });
        if (todayEntries.length === 0) return 'No entries logged today yet.';
        var entryLines = todayEntries.map(function (e) { return '[' + (e.type || 'general') + '] ' + e.text; }).join('\n');
        return 'You are a work summary assistant.\n\nToday\'s work log entries:\n' + entryLines + '\n\nWrite a concise narrative summary of today\'s work (3-5 sentences). Group by theme. Professional tone.';
      }
      if (featureId === 'weekly-report') {
        var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        var weekEntries = entries.filter(function (e) { return e.at && e.at.slice(0, 10) >= weekAgo; });
        if (weekEntries.length === 0) return 'No entries in the past 7 days.';
        var weekLines = weekEntries.map(function (e) { return e.at.slice(0, 10) + ' [' + (e.type || 'general') + '] ' + e.text; }).join('\n');
        return 'You are a work reporting assistant.\n\nWork log entries for the past week:\n' + weekLines + '\n\nWrite a weekly summary with 3 sections: "Completed", "In Progress", "Key Highlights". Bullet points. Professional tone suitable for a team update.';
      }
      if (featureId === 'suggest-entry') {
        var classifiers = (data.classifiers || []).join(', ') || 'general, meeting, coding, review, planning';
        return 'You are a work log assistant.\n\nThe user worked on: "' + userInput + '"\n\nAvailable log types: ' + classifiers + '\n\nRespond ONLY with valid JSON (no markdown fences):\n{"type":"log_type","text":"concise professional log entry in past tense"}\n\nKeep text under 100 characters.';
      }
    }

    if (appId === 'prompt_builder' && data) {
      var roles = data.roles || [];
      var activeRole = data.activeRoleId ? roles.find(function (r) { return r.id === data.activeRoleId; }) : roles[0];
      if (featureId === 'improve-prompt') {
        if (!activeRole) return 'No active role found.';
        return 'You are an expert prompt engineer.\n\nImprove this AI system prompt for clarity, specificity, and effectiveness:\n\n"""\n' + (activeRole.systemPrompt || activeRole.prompt || JSON.stringify(activeRole)) + '\n"""\n\nReturn ONLY the improved prompt text. No explanation, no labels.';
      }
      if (featureId === 'test-prompts') {
        if (!activeRole) return 'No active role found.';
        return 'You are an expert prompt tester.\n\nFor this AI role:\n"""\n' + (activeRole.systemPrompt || activeRole.prompt || JSON.stringify(activeRole)) + '\n"""\n\nGenerate 3 diverse user messages that would test the boundaries and capabilities of this role. Make them realistic and varied.\n\nRespond ONLY with valid JSON (no markdown fences):\n[{"message":"...","purpose":"what it tests"}]';
      }
      if (featureId === 'suggest-role') {
        return 'You are an expert prompt engineer.\n\nCreate a detailed AI system prompt for a role that: "' + userInput + '"\n\nRespond ONLY with valid JSON (no markdown fences):\n{"name":"Role Name","systemPrompt":"full system prompt text"}';
      }
    }

    if (appId === 'mind_map' && data && data.nodes) {
      var nodes = data.nodes || [];
      var edges = data.edges || [];
      var nodeTexts = nodes.map(function (n) { return n.text; }).join(', ');
      if (featureId === 'expand-node') {
        var targetText = userInput || (nodes[0] && nodes[0].text) || 'main topic';
        return 'You are a mind mapping assistant.\n\nCentral concept: "' + targetText + '"\nRelated concepts already in the map: ' + nodeTexts + '\n\nSuggest 5 new child concepts or sub-topics for "' + targetText + '" that are not already in the map.\n\nRespond ONLY with valid JSON (no markdown fences):\n[{"text":"concept name","color":"#3b82f6"}]';
      }
      if (featureId === 'suggest-connections') {
        var edgePairs = edges.map(function (e) {
          var from = nodes.find(function (n) { return n.id === e.from; });
          var to = nodes.find(function (n) { return n.id === e.to; });
          return from && to ? from.text + ' → ' + to.text : null;
        }).filter(Boolean).join('\n');
        return 'You are a mind mapping assistant.\n\nConcepts in the map: ' + nodeTexts + '\n\nExisting connections:\n' + (edgePairs || '(none)') + '\n\nSuggest 3-5 NEW connections between concepts that are not yet linked. Explain why each connection is meaningful.\n\nRespond as a bullet list: "Concept A → Concept B: reason"';
      }
      if (featureId === 'summarize-map') {
        return 'You are a mind mapping assistant.\n\nConcepts in this mind map: ' + nodeTexts + '\n\nWrite a 3-4 sentence summary of what this mind map appears to be about and the key themes it covers.';
      }
    }

    if (appId === 'text2md' && data && data.sections) {
      var secs = data.sections || [];
      if (featureId === 'improve-section') {
        var targetHeading = userInput || (secs[0] && secs[0].heading) || '';
        var targetSec = secs.find(function (s) { return s.heading && s.heading.toLowerCase().indexOf(targetHeading.toLowerCase()) !== -1; }) || secs[0];
        if (!targetSec) return 'No sections found.';
        return 'You are a technical writing assistant.\n\nImprove the following document section. Keep the same heading. Make the body clearer, more concise, and better structured.\n\nHeading: ' + targetSec.heading + '\nBody:\n' + (targetSec.body || '(empty)') + '\n\nRespond ONLY with valid JSON (no markdown fences):\n{"heading":"' + targetSec.heading + '","body":"improved body text"}';
      }
      if (featureId === 'generate-outline') {
        return 'You are a technical writing assistant.\n\nCreate a structured document outline for: "' + userInput + '"\n\nRespond ONLY with valid JSON (no markdown fences):\n{"title":"Document Title","sections":[{"heading":"Section Heading","body":"2-3 sentence placeholder content"}]}\n\n4-6 sections.';
      }
    }

    if (appId === 'world_clock' && data) {
      var zones = data.timezones || [];
      if (featureId === 'suggest-zones') {
        return 'You are a timezone assistant.\n\nThe user works with people in: "' + userInput + '"\n\nReturn the best IANA timezone identifiers for these locations.\n\nRespond ONLY with valid JSON (no markdown fences):\n["America/New_York","Europe/London"]\n\nReturn only the JSON array.';
      }
      if (featureId === 'meeting-time') {
        if (zones.length === 0) return 'No timezones configured yet. Add some timezones first.';
        return 'You are a scheduling assistant. Today is ' + today + '.\n\nFind the best 1-hour meeting window that falls within business hours (9am-6pm local time) for ALL of these timezones:\n' + zones.join(', ') + '\n\nRespond with a table showing the local time in each timezone for your recommended window. If no perfect overlap exists, suggest the best compromise.';
      }
    }

    // Generic / stateless apps — use selected text or user input
    if (featureId === 'explain' || featureId === 'explain-diff' || featureId === 'selection-assist') {
      var context = (data && data.selectedText) || userInput || window.getSelection().toString();
      if (!context) return 'Please select some text on the page first, then click this feature.';
      return 'Explain the following in clear, plain English. Be concise:\n\n' + context;
    }
    if (featureId === 'fix-schema') {
      var ctx = (data && data.selectedText) || userInput || window.getSelection().toString();
      return 'Analyze this JSON/YAML and identify any structural issues or improvements:\n\n' + ctx + '\n\nReturn the corrected version followed by a brief explanation of what was changed.';
    }
    if (featureId === 'suggest-steps' || featureId === 'suggest-stages') {
      return 'You are a process design assistant.\n\nDescribe the steps or stages for: "' + userInput + '"\n\nReturn a numbered list of clear, actionable steps.';
    }
    if (featureId === 'improve-input') {
      var sel = window.getSelection ? window.getSelection().toString() : '';
      return 'Rewrite the following text to be clearer and more structured for converting into a diagram:\n\n' + (sel || userInput);
    }

    return 'Analyze the data from this app and provide useful insights.\n\nApp: ' + appId + '\nFeature: ' + featureId + '\nUser input: ' + (userInput || 'none');
  }

  // ─── Apply AI result back to the app ──────────────────────────────────────

  function applyWriteback(appConfig, featureId, resultText, showToast) {
    try {
      var appId = appConfig.id;

      if (appId === 'task_tracker') {
        var state = JSON.parse(localStorage.getItem('task_tracker_v1'));
        if (!state || !state.tasks) return;

        if (featureId === 'suggest-tags') {
          var patches = JSON.parse(resultText);
          patches.forEach(function (p) {
            var task = state.tasks.find(function (t) { return t.id === p.id; });
            if (task && p.tags) task.tags = p.tags;
          });
          localStorage.setItem('task_tracker_v1', JSON.stringify(state));
          if (typeof window.render === 'function') window.render();
          showToast('Tags applied to ' + patches.length + ' task(s)');
          return;
        }
        if (featureId === 'add-task') {
          var newTask = JSON.parse(resultText);
          newTask.id = Date.now().toString(36) + Math.random().toString(36).slice(2);
          newTask.createdAt = new Date().toISOString();
          newTask.completedAt = null;
          newTask.comments = [];
          newTask.progress = 0;
          newTask.lastResetDate = null;
          newTask.recurringReset = false;
          newTask.isEvent = false;
          state.tasks.push(newTask);
          localStorage.setItem('task_tracker_v1', JSON.stringify(state));
          if (typeof window.render === 'function') window.render();
          showToast('Task "' + newTask.title + '" added');
          return;
        }
        if (featureId === 'prioritize') {
          var updates = JSON.parse(resultText);
          updates.forEach(function (u) {
            var task = state.tasks.find(function (t) { return t.id === u.id; });
            if (task && u.priority) task.priority = u.priority;
          });
          localStorage.setItem('task_tracker_v1', JSON.stringify(state));
          if (typeof window.render === 'function') window.render();
          showToast('Priority updated for ' + updates.length + ' task(s)');
          return;
        }
      }

      if (appId === 'checklist_builder') {
        var cbState = JSON.parse(localStorage.getItem('checklist_builder_v1'));
        if (!cbState || !cbState.sections) return;

        if (featureId === 'expand-section') {
          var newItems = JSON.parse(resultText);
          var section = cbState.sections[cbState.sections.length - 1];
          newItems.forEach(function (text) {
            section.items.push({ id: Math.random().toString(36).slice(2, 9), text: text, checked: false });
          });
          localStorage.setItem('checklist_builder_v1', JSON.stringify(cbState));
          if (typeof window.render === 'function') window.render();
          showToast('Added ' + newItems.length + ' items to section');
          return;
        }
        if (featureId === 'generate-checklist') {
          var newCl = JSON.parse(resultText);
          if (newCl.sections) {
            cbState.sections = newCl.sections.map(function (s) {
              return {
                id: Math.random().toString(36).slice(2, 9),
                name: s.name,
                items: (s.items || []).map(function (item) {
                  return { id: Math.random().toString(36).slice(2, 9), text: item.text || item, checked: false };
                })
              };
            });
            localStorage.setItem('checklist_builder_v1', JSON.stringify(cbState));
            if (typeof window.render === 'function') window.render();
            showToast('Checklist generated with ' + cbState.sections.length + ' sections');
          }
          return;
        }
      }

      if (appId === 'work_log') {
        if (featureId === 'suggest-entry') {
          var wlState = JSON.parse(localStorage.getItem('work_log_v1'));
          if (!wlState) return;
          var entry = JSON.parse(resultText);
          var newEntry = {
            id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36),
            type: entry.type || 'general',
            text: entry.text,
            at: new Date().toISOString()
          };
          if (!wlState.entries) wlState.entries = [];
          wlState.entries.unshift(newEntry);
          localStorage.setItem('work_log_v1', JSON.stringify(wlState));
          if (typeof window.save === 'function') window.save();
          else if (typeof window.render === 'function') window.render();
          showToast('Entry logged: ' + newEntry.text.slice(0, 40));
          return;
        }
      }

      if (appId === 'prompt_builder') {
        if (featureId === 'improve-prompt') {
          var pbRoles = JSON.parse(localStorage.getItem('pb_roles') || '[]');
          var activeId = localStorage.getItem('pb_active_role_id');
          var role = pbRoles.find(function (r) { return r.id === activeId; }) || pbRoles[0];
          if (role) {
            if ('systemPrompt' in role) role.systemPrompt = resultText;
            else if ('prompt' in role) role.prompt = resultText;
            localStorage.setItem('pb_roles', JSON.stringify(pbRoles));
            if (typeof window.render === 'function') window.render();
            showToast('Role prompt updated');
          }
          return;
        }
        if (featureId === 'suggest-role') {
          var newRole = JSON.parse(resultText);
          var existingRoles = JSON.parse(localStorage.getItem('pb_roles') || '[]');
          newRole.id = Date.now().toString(36);
          existingRoles.push(newRole);
          localStorage.setItem('pb_roles', JSON.stringify(existingRoles));
          if (typeof window.render === 'function') window.render();
          showToast('New role "' + newRole.name + '" added');
          return;
        }
      }

      if (appId === 'mind_map') {
        if (featureId === 'expand-node') {
          var mmState = JSON.parse(localStorage.getItem('mind_map_v1'));
          if (!mmState || !mmState.nodes) return;
          var newNodes = JSON.parse(resultText);
          var baseNode = mmState.nodes[mmState.nodes.length - 1] || { x: 400, y: 300 };
          newNodes.forEach(function (n, idx) {
            var angle = (idx / newNodes.length) * 2 * Math.PI;
            var newNode = {
              id: Math.random().toString(36).slice(2, 9),
              x: baseNode.x + Math.cos(angle) * 200,
              y: baseNode.y + Math.sin(angle) * 200,
              text: n.text,
              color: n.color || '#3b82f6'
            };
            mmState.nodes.push(newNode);
            if (baseNode.id) mmState.edges.push({ from: baseNode.id, to: newNode.id });
          });
          localStorage.setItem('mind_map_v1', JSON.stringify(mmState));
          if (typeof window.saveState === 'function') window.saveState();
          if (typeof window.draw === 'function') window.draw();
          else if (typeof window.render === 'function') window.render();
          showToast('Added ' + newNodes.length + ' nodes to the map');
          return;
        }
      }

      if (appId === 'text2md') {
        if (featureId === 'improve-section') {
          var tmState = JSON.parse(localStorage.getItem('text2md_state') || '{}');
          var improved = JSON.parse(resultText);
          if (tmState.sections && improved.heading) {
            var secIdx = tmState.sections.findIndex(function (s) { return s.heading === improved.heading; });
            if (secIdx === -1) secIdx = 0;
            if (tmState.sections[secIdx]) tmState.sections[secIdx].body = improved.body;
            localStorage.setItem('text2md_state', JSON.stringify(tmState));
            var cards = document.querySelectorAll('.section-card, .section-body, textarea');
            cards.forEach(function (el) {
              if (el.tagName === 'TEXTAREA') {
                el.value = improved.body;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            });
            showToast('Section updated');
          }
          return;
        }
        if (featureId === 'generate-outline') {
          var outline = JSON.parse(resultText);
          var tmState2 = JSON.parse(localStorage.getItem('text2md_state') || '{}');
          if (outline.title) tmState2.title = outline.title;
          if (outline.sections) tmState2.sections = outline.sections;
          localStorage.setItem('text2md_state', JSON.stringify(tmState2));
          showToast('Outline generated — reload to see it applied');
          return;
        }
      }

      if (appId === 'world_clock') {
        if (featureId === 'suggest-zones') {
          var wcState = JSON.parse(localStorage.getItem('world_clock_v1') || '{}');
          var zones = JSON.parse(resultText);
          if (!wcState.timezones) wcState.timezones = [];
          zones.forEach(function (z) { if (wcState.timezones.indexOf(z) === -1) wcState.timezones.push(z); });
          localStorage.setItem('world_clock_v1', JSON.stringify(wcState));
          if (typeof window.render === 'function') window.render();
          else window.location.reload();
          showToast('Added ' + zones.length + ' timezone(s)');
          return;
        }
      }

      showToast('No write-back available for this feature — result is read-only');
    } catch (e) {
      showToast('Apply failed: ' + e.message, true);
    }
  }

  // ─── Build the shadow DOM panel ───────────────────────────────────────────

  function init() {
    // Skip hub and unknown-structure pages silently if no data exists
    var appConfig = detectApp();

    // Create host element
    var host = document.createElement('div');
    host.id = 'ai-assist-host';
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;all:initial;font-family:sans-serif;';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'closed' });

    // Inject styles
    var styleEl = document.createElement('link');
    styleEl.rel = 'stylesheet';
    // We'll use inline styles since we can't easily reference extension URLs in closed shadow
    var style = document.createElement('style');
    style.textContent = getShadowStyles();
    shadow.appendChild(style);

    // Build panel HTML
    var panelHTML = buildPanelHTML(appConfig);
    var container = document.createElement('div');
    container.innerHTML = panelHTML;
    shadow.appendChild(container);

    // ── Wire events ──
    var triggerBtn = shadow.getElementById('ai-trigger');
    var panel = shadow.getElementById('ai-panel');
    var closeBtn = shadow.getElementById('ai-close');
    var responseArea = shadow.getElementById('ai-response');
    var applyBtn = shadow.getElementById('ai-apply');
    var copyBtn = shadow.getElementById('ai-copy');
    var dismissBtn = shadow.getElementById('ai-dismiss');
    var inputArea = shadow.getElementById('ai-input');
    var featureBtns = shadow.querySelectorAll('.ai-feature-btn');
    var actionBar = shadow.getElementById('ai-action-bar');

    var lastResult = '';
    var lastFeatureId = '';
    var isOpen = false;

    function showToast(msg, isError) {
      var t = shadow.getElementById('ai-toast');
      if (!t) return;
      t.textContent = msg;
      t.className = 'ai-toast' + (isError ? ' ai-toast-error' : ' ai-toast-ok');
      t.style.display = 'block';
      setTimeout(function () { t.style.display = 'none'; }, 3000);
    }

    function openPanel() {
      isOpen = true;
      panel.style.display = 'flex';
      triggerBtn.classList.add('ai-trigger-active');
    }

    function closePanel() {
      isOpen = false;
      panel.style.display = 'none';
      triggerBtn.classList.remove('ai-trigger-active');
    }

    function showLoading() {
      responseArea.innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';
      applyBtn.style.display = 'none';
      copyBtn.style.display = 'none';
      dismissBtn.style.display = 'none';
      actionBar.style.display = 'none';
    }

    function showResult(text, canApply) {
      lastResult = text;
      responseArea.innerHTML = '<div class="ai-result-text">' + escapeHTML(text) + '</div>';
      actionBar.style.display = 'flex';
      copyBtn.style.display = 'inline-flex';
      dismissBtn.style.display = 'inline-flex';
      applyBtn.style.display = canApply ? 'inline-flex' : 'none';
    }

    function showError(msg) {
      responseArea.innerHTML = '<div class="ai-error">' + escapeHTML(msg) + '</div>';
      actionBar.style.display = 'flex';
      copyBtn.style.display = 'none';
      dismissBtn.style.display = 'inline-flex';
      applyBtn.style.display = 'none';
    }

    function clearPanel() {
      responseArea.innerHTML = '<div class="ai-placeholder">Click a feature above to get started.</div>';
      actionBar.style.display = 'none';
      lastResult = '';
      lastFeatureId = '';
    }

    triggerBtn.addEventListener('click', function () {
      isOpen ? closePanel() : openPanel();
    });

    closeBtn.addEventListener('click', closePanel);

    dismissBtn.addEventListener('click', clearPanel);

    copyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      navigator.clipboard.writeText(lastResult).then(function () {
        showToast('Copied to clipboard');
      }).catch(function () {
        showToast('Copy failed — select text manually');
      });
    });

    applyBtn.addEventListener('click', function () {
      if (!lastResult || !lastFeatureId) return;
      applyWriteback(appConfig, lastFeatureId, lastResult, showToast);
    });

    featureBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var featureId = btn.getAttribute('data-feature');
        var needsInput = btn.getAttribute('data-needs-input') === 'true';
        lastFeatureId = featureId;

        var userInput = '';
        if (needsInput && inputArea) {
          userInput = inputArea.value.trim();
        }

        var data = readAppData(appConfig);
        var prompt = buildPrompt(appConfig.id, featureId, data, userInput);

        if (prompt.indexOf('No ') === 0 || prompt.indexOf('All tasks') === 0) {
          showResult(prompt, false);
          return;
        }

        showLoading();

        // Determine if result is JSON (can apply) based on feature
        var applyableFeatures = ['suggest-tags', 'add-task', 'prioritize', 'expand-section', 'generate-checklist', 'suggest-entry', 'improve-prompt', 'suggest-role', 'expand-node', 'improve-section', 'generate-outline', 'suggest-zones'];
        var canApply = applyableFeatures.indexOf(featureId) !== -1 && appConfig.storageKey !== null;

        chrome.runtime.sendMessage(
          { type: 'AI_REQUEST', prompt: prompt },
          function (response) {
            if (chrome.runtime.lastError) {
              showError('Extension error: ' + chrome.runtime.lastError.message);
              return;
            }
            if (response && response.ok) {
              showResult(response.content, canApply);
            } else {
              showError(response ? response.error : 'Unknown error from background');
            }
          }
        );
      });
    });

    // Show input area when needed
    featureBtns.forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        var needsInput = btn.getAttribute('data-needs-input') === 'true';
        if (inputArea) {
          var ph = btn.getAttribute('data-placeholder') || '';
          inputArea.placeholder = ph;
          inputArea.style.display = needsInput ? 'block' : 'none';
        }
      });
    });

    // Check if API key is configured
    chrome.storage.sync.get(['aiProvider', 'aiKey', 'ollamaUrl', 'ollamaModel'], function (settings) {
      var configured = (settings.aiProvider === 'ollama' && settings.ollamaUrl) ||
        (settings.aiProvider === 'mcp' && settings.mcpUrl) ||
        (settings.aiKey && settings.aiKey.trim().length > 10);
      if (!configured) {
        var notice = shadow.getElementById('ai-notice');
        if (notice) {
          notice.style.display = 'block';
          notice.innerHTML = '⚠ <a class="ai-options-link" href="#" id="open-options">Configure your AI provider</a> to get started.';
          var link = shadow.getElementById('open-options');
          if (link) {
            link.addEventListener('click', function (e) {
              e.preventDefault();
              chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
            });
          }
        }
      }
    });
  }

  // ─── HTML builders ────────────────────────────────────────────────────────

  function buildPanelHTML(appConfig) {
    var featureButtons = appConfig.features.map(function (f) {
      return '<button class="ai-feature-btn" data-feature="' + f.id + '" data-needs-input="' + (f.needsInput ? 'true' : 'false') + '" data-placeholder="' + (f.placeholder || '') + '">' + f.label + '</button>';
    }).join('');

    return [
      '<button id="ai-trigger" title="AI Assist">✦</button>',
      '<div id="ai-panel" style="display:none">',
      '  <div id="ai-header">',
      '    <span class="ai-title">✦ AI Assist</span>',
      '    <span class="ai-app-badge">' + escapeHTML(appConfig.title) + '</span>',
      '    <button id="ai-close" title="Close">✕</button>',
      '  </div>',
      '  <div id="ai-notice" style="display:none"></div>',
      '  <div id="ai-features">' + featureButtons + '</div>',
      '  <textarea id="ai-input" placeholder="Enter details..." style="display:none"></textarea>',
      '  <div id="ai-response"><div class="ai-placeholder">Click a feature above to get started.</div></div>',
      '  <div id="ai-action-bar" style="display:none">',
      '    <button id="ai-apply" style="display:none">Apply</button>',
      '    <button id="ai-copy" style="display:none">Copy</button>',
      '    <button id="ai-dismiss" style="display:none">Dismiss</button>',
      '  </div>',
      '</div>',
      '<div id="ai-toast" style="display:none"></div>'
    ].join('\n');
  }

  function getShadowStyles() {
    return [
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      '#ai-trigger {',
      '  width: 44px; height: 44px; border-radius: 50%;',
      '  background: #3b82f6; color: #fff; border: none;',
      '  font-size: 20px; cursor: pointer; display: flex;',
      '  align-items: center; justify-content: center;',
      '  box-shadow: 0 2px 12px rgba(59,130,246,0.5);',
      '  transition: transform 0.15s, box-shadow 0.15s;',
      '  position: relative; z-index: 1;',
      '}',
      '#ai-trigger:hover { transform: scale(1.1); box-shadow: 0 4px 20px rgba(59,130,246,0.6); }',
      '#ai-trigger.ai-trigger-active { background: #1d4ed8; }',
      '#ai-panel {',
      '  position: absolute; bottom: 54px; right: 0;',
      '  width: 360px; max-height: calc(100vh - 120px);',
      '  background: #ffffff; border-radius: 12px;',
      '  box-shadow: 0 8px 40px rgba(0,0,0,0.18); border: 1px solid #e2e8f0;',
      '  display: flex; flex-direction: column; overflow: hidden;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  font-size: 13px; color: #1e293b;',
      '}',
      '#ai-header {',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 10px 12px; background: #f8fafc;',
      '  border-bottom: 1px solid #e2e8f0; flex-shrink: 0;',
      '}',
      '.ai-title { font-weight: 600; font-size: 14px; color: #3b82f6; flex: 1; }',
      '.ai-app-badge {',
      '  font-size: 11px; background: #eff6ff; color: #3b82f6;',
      '  border: 1px solid #bfdbfe; border-radius: 4px; padding: 2px 6px;',
      '}',
      '#ai-close {',
      '  background: none; border: none; color: #94a3b8;',
      '  cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px;',
      '}',
      '#ai-close:hover { background: #f1f5f9; color: #475569; }',
      '#ai-notice {',
      '  padding: 8px 12px; background: #fffbeb; border-bottom: 1px solid #fde68a;',
      '  font-size: 12px; color: #92400e;',
      '}',
      '.ai-options-link { color: #d97706; font-weight: 600; text-decoration: underline; cursor: pointer; }',
      '#ai-features {',
      '  display: flex; flex-wrap: wrap; gap: 6px;',
      '  padding: 10px 12px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;',
      '}',
      '.ai-feature-btn {',
      '  padding: 5px 10px; border-radius: 6px; border: 1px solid #e2e8f0;',
      '  background: #f8fafc; color: #475569; cursor: pointer;',
      '  font-size: 12px; font-weight: 500; transition: all 0.12s;',
      '}',
      '.ai-feature-btn:hover { background: #3b82f6; color: #fff; border-color: #3b82f6; }',
      '#ai-input {',
      '  margin: 8px 12px 0; padding: 8px 10px;',
      '  border: 1px solid #e2e8f0; border-radius: 6px;',
      '  font-size: 12px; color: #1e293b; resize: vertical; min-height: 56px;',
      '  font-family: inherit; outline: none;',
      '}',
      '#ai-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }',
      '#ai-response {',
      '  flex: 1; overflow-y: auto; padding: 10px 12px;',
      '  min-height: 80px; max-height: 280px;',
      '}',
      '.ai-placeholder { color: #94a3b8; font-size: 12px; font-style: italic; }',
      '.ai-result-text { white-space: pre-wrap; line-height: 1.55; font-size: 12.5px; color: #1e293b; }',
      '.ai-error { color: #dc2626; font-size: 12px; }',
      '.ai-loading { display: flex; gap: 5px; align-items: center; justify-content: center; padding: 20px; }',
      '.ai-loading span {',
      '  width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;',
      '  animation: ai-pulse 1.2s ease-in-out infinite;',
      '}',
      '.ai-loading span:nth-child(2) { animation-delay: 0.2s; }',
      '.ai-loading span:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes ai-pulse { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }',
      '#ai-action-bar {',
      '  display: flex; gap: 6px; padding: 8px 12px;',
      '  border-top: 1px solid #f1f5f9; flex-shrink: 0;',
      '}',
      '#ai-action-bar button {',
      '  padding: 5px 12px; border-radius: 6px; border: none;',
      '  font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.12s;',
      '}',
      '#ai-apply { background: #3b82f6; color: #fff; }',
      '#ai-apply:hover { background: #2563eb; }',
      '#ai-copy { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0 !important; }',
      '#ai-copy:hover { background: #e2e8f0; }',
      '#ai-dismiss { background: none; color: #94a3b8; margin-left: auto; }',
      '#ai-dismiss:hover { color: #475569; }',
      '#ai-toast {',
      '  position: absolute; bottom: 54px; right: 0;',
      '  padding: 8px 14px; border-radius: 8px;',
      '  font-size: 12px; font-weight: 500; white-space: nowrap;',
      '  box-shadow: 0 2px 10px rgba(0,0,0,0.12);',
      '}',
      '.ai-toast-ok { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }',
      '.ai-toast-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }'
    ].join('\n');
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
