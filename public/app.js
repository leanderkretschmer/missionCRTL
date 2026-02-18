const state = {
  user: null,
  integrations: {},
  pods: [],
  projects: [],
  activeView: 'active',
  selectedType: null,
  selectedId: null,
  chat: []
};

const contentArea = document.getElementById('contentArea');

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Fehler bei der Anfrage');
  }

  return response.json();
}

async function loadState() {
  const data = await api('/api/state');
  state.user = data.users[0];
  state.integrations = data.integrations;
  state.pods = data.pods;
  state.projects = data.projects;
  render();
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  render();
}

function getSelectedEntity() {
  if (state.selectedType === 'pod') {
    return state.pods.find((p) => p.id === state.selectedId) || null;
  }

  if (state.selectedType === 'project') {
    return state.projects.find((p) => p.id === state.selectedId) || null;
  }

  return null;
}

function render() {
  document.getElementById('workspaceBadge').textContent = `Workspace: ${state.user?.workspaces ? 'arbeit / privat' : '—'}`;

  if (state.activeView === 'active') {
    renderActiveView();
    return;
  }
  if (state.activeView === 'projects') {
    renderProjectsView();
    return;
  }
  if (state.activeView === 'pods') {
    renderPodsView();
    return;
  }
  if (state.activeView === 'settings') {
    renderSettingsView();
    return;
  }

  renderSuggestion();
}

function renderSuggestion() {
  const template = document.getElementById('suggestionTemplate');
  contentArea.innerHTML = '';
  contentArea.appendChild(template.content.cloneNode(true));
}

function renderActiveView() {
  const activeProjects = state.projects.filter((p) => p.tickets?.length);
  const selected = getSelectedEntity();

  contentArea.innerHTML = `
    <div class="panel">
      <h2>Aktive Projekte</h2>
      <p class="muted">Hier siehst du laufende Projekte und kannst direkt in Details wechseln.</p>
      ${activeProjects.length ? activeProjects.map((project) => `
        <div class="list-item">
          <strong>${project.name}</strong>
          <div class="muted">Tracker: ${project.issueTracker || '—'} | Repo: ${project.repoHost || '—'}</div>
          <div class="inline-actions">
            <button data-open-project="${project.id}">Öffnen</button>
          </div>
        </div>
      `).join('') : '<div class="list-item">Keine aktiven Projekte. Wandle einen Pod um.</div>'}
    </div>
  `;

  if (selected) {
    renderEntityDetail(selected);
  } else if (!activeProjects.length) {
    renderSuggestion();
  }

  bindDynamicEvents();
}

function renderProjectsView() {
  const selected = getSelectedEntity();
  contentArea.innerHTML = `
    <div class="panel">
      <h2>Projekte</h2>
      ${state.projects.length ? state.projects.map((project) => `
        <div class="list-item">
          <strong>${project.name}</strong> <span class="muted">(${project.id})</span>
          <div class="muted">${project.description || 'Keine Beschreibung'}</div>
          <div class="inline-actions">
            <button data-open-project="${project.id}">Details</button>
          </div>
        </div>
      `).join('') : '<div class="list-item">Noch keine Projekte vorhanden.</div>'}
    </div>
  `;

  if (selected && state.selectedType === 'project') {
    renderEntityDetail(selected);
  }

  bindDynamicEvents();
}

function renderPodsView() {
  const selected = getSelectedEntity();
  contentArea.innerHTML = `
    <div class="panel">
      <h2>Pods</h2>
      <form id="podForm" class="grid-2">
        <input name="name" placeholder="Pod Name" required />
        <input name="workspace" placeholder="arbeit oder privat" required />
        <textarea name="description" placeholder="Beschreibung"></textarea>
        <button type="submit">Pod speichern</button>
      </form>
    </div>

    <div class="panel">
      <h3>Pod Liste</h3>
      ${state.pods.map((pod) => `
        <div class="list-item">
          <strong>${pod.name}</strong> <span class="muted">(${pod.id})</span>
          <div class="muted">Status: ${pod.status}</div>
          <div class="inline-actions">
            <button data-open-pod="${pod.id}">Öffnen</button>
            <button data-convert-pod="${pod.id}" data-issue="redmine" data-repo="github">Zu Projekt (Redmine+GitHub)</button>
            <button data-convert-pod="${pod.id}" data-issue="openproject" data-repo="forgejo">Zu Projekt (OpenProject+Forgejo)</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  if (selected && state.selectedType === 'pod') {
    renderEntityDetail(selected);
  }

  bindDynamicEvents();
}

function renderSettingsView() {
  const integrations = ['github', 'forgejo', 'redmine', 'openproject', 'signal', 'whatsapp'];
  const workspaceDefaults = state.user?.workspaces || {};

  contentArea.innerHTML = `
    <div class="panel">
      <h2>Settings</h2>
      <p class="muted">Hier konfigurierst du Verbindungen zu WhatsApp, Signal und den Projekttools.</p>
      <div class="grid-2">
        ${integrations.map((tool) => `
          <div class="list-item">
            <strong>${tool}</strong>
            <div class="muted">Status: ${state.integrations[tool]?.connected ? 'Verbunden' : 'Nicht verbunden'}</div>
            <div class="inline-actions">
              <button data-connect-tool="${tool}">${state.integrations[tool]?.connected ? 'Neu verbinden' : 'Verbinden'}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Workspace Defaults</h3>
      ${Object.entries(workspaceDefaults).map(([name, cfg]) => `
        <div class="list-item">
          <strong>${name}</strong>
          <div class="muted">Issue Default: ${cfg.defaultIssueTool}</div>
          <div class="muted">Repo Default: ${cfg.defaultRepoTool}</div>
        </div>
      `).join('')}
    </div>

    <div class="panel">
      <h3>Signal / WhatsApp Sniffer</h3>
      <form id="snifferForm" class="grid-2">
        <select name="provider" required>
          <option value="signal">signal</option>
          <option value="whatsapp">whatsapp</option>
        </select>
        <input name="channel" placeholder="z.B. Teamgruppe" required />
        <input name="boundTo" placeholder="Pod-ID oder Projekt-ID" required />
        <select name="targetType" required>
          <option value="pod">pod</option>
          <option value="project">project</option>
        </select>
        <select name="mode" required>
          <option value="project-info">project-info</option>
          <option value="pod-source">pod-source</option>
        </select>
        <button type="submit">Sniffer speichern</button>
      </form>
      <div id="snifferResult" class="muted"></div>
    </div>
  `;

  bindDynamicEvents();
}

function renderEntityDetail(entity) {
  const wrapper = document.createElement('div');
  wrapper.className = 'panel';

  const isProject = state.selectedType === 'project';
  const title = isProject ? 'Projekt Details' : 'Pod Details';
  const tickets = isProject ? entity.tickets || [] : entity.tasks || [];

  wrapper.innerHTML = `
    <h3>${title}: ${entity.name}</h3>
    <p>${entity.description || 'Keine Beschreibung vorhanden.'}</p>
    <div class="muted">Infos: ${(entity.infoFeed || []).join(' | ') || '—'}</div>

    <h4>Tickets / Unteraufgaben</h4>
    ${tickets.length ? tickets.map((ticket) => `
      <div class="list-item">
        <strong>${ticket.title}</strong>
        <div class="muted">Fällig: ${ticket.dueDate || 'offen'} | ID: ${ticket.id}</div>
        <div class="inline-actions">
          <button data-start-timer="${ticket.id}">Start</button>
          <button data-stop-timer="${ticket.id}">Stop</button>
        </div>
      </div>
    `).join('') : '<div class="list-item">Keine Tickets vorhanden.</div>'}
  `;

  contentArea.appendChild(wrapper);
}

function bindDynamicEvents() {
  document.querySelectorAll('[data-open-project]').forEach((btn) => {
    btn.onclick = () => {
      state.selectedType = 'project';
      state.selectedId = btn.dataset.openProject;
      render();
    };
  });

  document.querySelectorAll('[data-open-pod]').forEach((btn) => {
    btn.onclick = () => {
      state.selectedType = 'pod';
      state.selectedId = btn.dataset.openPod;
      render();
    };
  });

  document.querySelectorAll('[data-convert-pod]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/pods/${btn.dataset.convertPod}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          issueTracker: btn.dataset.issue,
          repoHost: btn.dataset.repo,
          createIssueProject: true,
          createRepo: true
        })
      });
      state.selectedType = 'project';
      await loadState();
    };
  });

  document.querySelectorAll('[data-connect-tool]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/integrations/${btn.dataset.connectTool}/connect`, {
        method: 'POST',
        body: JSON.stringify({ connectedAt: new Date().toISOString() })
      });
      await loadState();
    };
  });

  const podForm = document.getElementById('podForm');
  if (podForm) {
    podForm.onsubmit = async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(podForm).entries());
      await api('/api/pods', { method: 'POST', body: JSON.stringify(payload) });
      podForm.reset();
      await loadState();
    };
  }

  const snifferForm = document.getElementById('snifferForm');
  if (snifferForm) {
    snifferForm.onsubmit = async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(snifferForm).entries());
      try {
        const result = await api('/api/sniffers', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('snifferResult').textContent = `Sniffer ${result.id} aktiv.`;
      } catch (error) {
        document.getElementById('snifferResult').textContent = error.message;
      }
      await loadState();
    };
  }

  document.querySelectorAll('[data-start-timer]').forEach((btn) => {
    btn.onclick = async () => {
      const projectId = state.selectedType === 'project' ? state.selectedId : state.projects[0]?.id;
      if (!projectId) return;
      await api(`/api/projects/${projectId}/tickets/${btn.dataset.startTimer}/timer`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' })
      });
    };
  });

  document.querySelectorAll('[data-stop-timer]').forEach((btn) => {
    btn.onclick = async () => {
      const projectId = state.selectedType === 'project' ? state.selectedId : state.projects[0]?.id;
      if (!projectId) return;
      await api(`/api/projects/${projectId}/tickets/${btn.dataset.stopTimer}/timer`, {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' })
      });
    };
  });
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('aiForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  const chatMessages = document.getElementById('chatMessages');
  state.chat.push({ role: 'user', text: payload.message });

  try {
    const result = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify(payload) });
    state.chat.push({ role: 'ai', text: `[${result.provider}] ${result.answer}` });
  } catch (error) {
    state.chat.push({ role: 'ai', text: `Fehler: ${error.message}` });
  }

  chatMessages.innerHTML = state.chat
    .slice(-10)
    .map((msg) => `<div class="message ${msg.role}">${msg.text}</div>`)
    .join('');

  form.reset();
});

loadState().then(() => {
  if (!state.projects.length && !state.pods.length) {
    renderSuggestion();
  }
});
