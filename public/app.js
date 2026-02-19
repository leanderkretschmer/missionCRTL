const PAGE_SIZE = 3;

const state = {
  user: null,
  integrations: {},
  pods: [],
  projects: [],
  activeView: 'active',
  selectedType: null,
  selectedId: null,
  chat: [],
  pages: {
    active: 1,
    projects: 1,
    pods: 1
  }
};

const contentArea = document.getElementById('contentArea');
const contentHead = document.getElementById('contentHead');

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

function paginate(items, view) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (state.pages[view] > totalPages) {
    state.pages[view] = totalPages;
  }
  const page = state.pages[view];
  const start = (page - 1) * PAGE_SIZE;
  return {
    slice: items.slice(start, start + PAGE_SIZE),
    page,
    totalPages,
    totalItems: items.length
  };
}

function renderHead(title, subtitle, view, pageMeta) {
  const pageInfo = pageMeta
    ? `<div class="pagination">
        <button data-page-action="prev" data-page-view="${view}">◀</button>
        <span class="muted">Seite ${pageMeta.page}/${pageMeta.totalPages} · ${pageMeta.totalItems} Einträge</span>
        <button data-page-action="next" data-page-view="${view}">▶</button>
      </div>`
    : '<span class="muted">No pagination</span>';

  contentHead.innerHTML = `
    <div>
      <strong>${title}</strong>
      <div class="muted">${subtitle}</div>
    </div>
    ${pageInfo}
  `;
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

async function loadState() {
  const data = await api('/api/state');
  state.user = data.users[0];
  state.integrations = data.integrations;
  state.pods = data.pods;
  state.projects = data.projects;

  document.getElementById('workspaceBadge').textContent = `Workspace: ${state.user?.workspaces ? 'arbeit / privat' : '—'}`;
  render();
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  render();
}

function renderSuggestion() {
  const template = document.getElementById('emptyTemplate');
  contentArea.innerHTML = '';
  contentArea.appendChild(template.content.cloneNode(true));
}

function renderActiveView() {
  const activeProjects = state.projects.filter((project) => (project.tickets || []).length > 0);
  const pageMeta = paginate(activeProjects, 'active');
  renderHead('Aktiv', 'Laufende Projekte und aktive Tickets', 'active', pageMeta);

  contentArea.innerHTML = `
    <div class="panel">
      ${pageMeta.slice.length
        ? pageMeta.slice
            .map(
              (project) => `
          <div class="list-item">
            <strong>${project.name}</strong>
            <div class="muted">Tracker: ${project.issueTracker || '—'} · Repo: ${project.repoHost || '—'}</div>
            <div class="inline-actions">
              <button data-open-project="${project.id}">Open</button>
            </div>
          </div>`
            )
            .join('')
        : '<div class="list-item">Keine aktiven Projekte vorhanden.</div>'}
    </div>
  `;

  const selected = getSelectedEntity();
  if (selected && state.selectedType === 'project') {
    renderEntityDetail(selected);
  } else if (!pageMeta.totalItems) {
    renderSuggestion();
  }

  bindDynamicEvents();
}

function renderProjectsView() {
  const pageMeta = paginate(state.projects, 'projects');
  renderHead('Projekte', 'Alle bestehenden Projekte', 'projects', pageMeta);

  contentArea.innerHTML = `
    <div class="panel">
      ${pageMeta.slice.length
        ? pageMeta.slice
            .map(
              (project) => `
          <div class="list-item">
            <strong>${project.name}</strong> <span class="muted">(${project.id})</span>
            <div class="muted">${project.description || 'Keine Beschreibung'}</div>
            <div class="inline-actions"><button data-open-project="${project.id}">Details</button></div>
          </div>`
            )
            .join('')
        : '<div class="list-item">Noch keine Projekte vorhanden.</div>'}
    </div>
  `;

  const selected = getSelectedEntity();
  if (selected && state.selectedType === 'project') {
    renderEntityDetail(selected);
  }

  bindDynamicEvents();
}

function renderPodsView() {
  const pageMeta = paginate(state.pods, 'pods');
  renderHead('Pods', 'Ideen, Entwürfe und geplante Initiativen', 'pods', pageMeta);

  contentArea.innerHTML = `
    <div class="panel">
      <h3>Neuen Pod erstellen</h3>
      <form id="podForm" class="grid-2">
        <input name="name" placeholder="Pod Name" required />
        <input name="workspace" placeholder="arbeit oder privat" required />
        <textarea name="description" placeholder="Beschreibung"></textarea>
        <button type="submit">Create Pod</button>
      </form>
    </div>

    <div class="panel">
      <h3>Pod-Backlog</h3>
      ${pageMeta.slice
        .map(
          (pod) => `
        <div class="list-item">
          <strong>${pod.name}</strong> <span class="muted">(${pod.id})</span>
          <div class="muted">Status: ${pod.status}</div>
          <div class="inline-actions">
            <button data-open-pod="${pod.id}">Öffnen</button>
            <button data-convert-pod="${pod.id}" data-issue="redmine" data-repo="github">Redmine + GitHub</button>
            <button data-convert-pod="${pod.id}" data-issue="openproject" data-repo="forgejo">OpenProject + Forgejo</button>
          </div>
        </div>`
        )
        .join('') || '<div class="list-item">Keine Pods verfügbar.</div>'}
    </div>
  `;

  const selected = getSelectedEntity();
  if (selected && state.selectedType === 'pod') {
    renderEntityDetail(selected);
  }

  bindDynamicEvents();
}

function renderSettingsView() {
  renderHead('Settings', 'Integrationen, Defaults und Sniffer-Konfiguration', null, null);
  const tools = ['github', 'forgejo', 'redmine', 'openproject', 'signal', 'whatsapp'];
  const workspaceDefaults = state.user?.workspaces || {};

  contentArea.innerHTML = `
    <div class="panel">
      <h3>Verbindungen</h3>
      <div class="grid-2">
        ${tools
          .map(
            (tool) => `
          <div class="list-item">
            <strong>${tool}</strong>
            <div class="muted">Status: ${state.integrations[tool]?.connected ? 'Verbunden' : 'Nicht verbunden'}</div>
            <div class="inline-actions"><button data-connect-tool="${tool}">${state.integrations[tool]?.connected ? 'Neu verbinden' : 'Verbinden'}</button></div>
          </div>`
          )
          .join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Workspace Defaults</h3>
      ${Object.entries(workspaceDefaults)
        .map(
          ([name, cfg]) => `
        <div class="list-item">
          <strong>${name}</strong>
          <div class="muted">Issue: ${cfg.defaultIssueTool}</div>
          <div class="muted">Repo: ${cfg.defaultRepoTool}</div>
        </div>`
        )
        .join('')}
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
  const isProject = state.selectedType === 'project';
  const tickets = isProject ? entity.tickets || [] : entity.tasks || [];

  const detail = document.createElement('div');
  detail.className = 'panel';
  detail.innerHTML = `
    <h3>${isProject ? 'Projekt' : 'Pod'}: ${entity.name}</h3>
    <p>${entity.description || 'Keine Beschreibung vorhanden.'}</p>
    <div class="muted">Info Feed: ${(entity.infoFeed || []).join(' · ') || '—'}</div>
    <h4>Tickets / Unteraufgaben</h4>
    ${tickets.length
      ? tickets
          .map(
            (ticket) => `
        <div class="list-item">
          <strong>${ticket.title}</strong>
          <div class="muted">Fällig: ${ticket.dueDate || 'offen'} | ID: ${ticket.id}</div>
          <div class="inline-actions">
            <button data-start-timer="${ticket.id}">Start</button>
            <button data-stop-timer="${ticket.id}">Stop</button>
          </div>
        </div>`
          )
          .join('')
      : '<div class="list-item">Keine Tickets vorhanden.</div>'}
  `;

  contentArea.appendChild(detail);
}

function render() {
  if (state.activeView === 'active') return renderActiveView();
  if (state.activeView === 'projects') return renderProjectsView();
  if (state.activeView === 'pods') return renderPodsView();
  if (state.activeView === 'settings') return renderSettingsView();
  return renderSuggestion();
}

function bindDynamicEvents() {
  document.querySelectorAll('[data-open-project]').forEach((button) => {
    button.onclick = () => {
      state.selectedType = 'project';
      state.selectedId = button.dataset.openProject;
      render();
    };
  });

  document.querySelectorAll('[data-open-pod]').forEach((button) => {
    button.onclick = () => {
      state.selectedType = 'pod';
      state.selectedId = button.dataset.openPod;
      render();
    };
  });

  document.querySelectorAll('[data-convert-pod]').forEach((button) => {
    button.onclick = async () => {
      await api(`/api/pods/${button.dataset.convertPod}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          issueTracker: button.dataset.issue,
          repoHost: button.dataset.repo,
          createIssueProject: true,
          createRepo: true
        })
      });
      state.selectedType = 'project';
      state.selectedId = null;
      await loadState();
      setView('projects');
    };
  });

  document.querySelectorAll('[data-connect-tool]').forEach((button) => {
    button.onclick = async () => {
      await api(`/api/integrations/${button.dataset.connectTool}/connect`, {
        method: 'POST',
        body: JSON.stringify({ connectedAt: new Date().toISOString() })
      });
      await loadState();
    };
  });

  document.querySelectorAll('[data-start-timer]').forEach((button) => {
    button.onclick = async () => {
      const projectId = state.selectedType === 'project' ? state.selectedId : state.projects[0]?.id;
      if (!projectId) return;
      await api(`/api/projects/${projectId}/tickets/${button.dataset.startTimer}/timer`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' })
      });
    };
  });

  document.querySelectorAll('[data-stop-timer]').forEach((button) => {
    button.onclick = async () => {
      const projectId = state.selectedType === 'project' ? state.selectedId : state.projects[0]?.id;
      if (!projectId) return;
      await api(`/api/projects/${projectId}/tickets/${button.dataset.stopTimer}/timer`, {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' })
      });
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
      const resultBox = document.getElementById('snifferResult');
      try {
        const result = await api('/api/sniffers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        resultBox.textContent = `Sniffer ${result.id} aktiv.`;
      } catch (error) {
        resultBox.textContent = error.message;
      }
      await loadState();
    };
  }

  document.querySelectorAll('[data-page-action]').forEach((button) => {
    button.onclick = () => {
      const view = button.dataset.pageView;
      if (!view) return;
      if (button.dataset.pageAction === 'prev') {
        state.pages[view] = Math.max(1, state.pages[view] - 1);
      } else {
        state.pages[view] += 1;
      }
      render();
    };
  });
}

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.getElementById('aiForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  state.chat.push({ role: 'user', text: payload.message });
  try {
    const result = await api('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.chat.push({ role: 'ai', text: `[${result.provider}] ${result.answer}` });
  } catch (error) {
    state.chat.push({ role: 'ai', text: `Fehler: ${error.message}` });
  }

  document.getElementById('chatMessages').innerHTML = state.chat
    .slice(-10)
    .map((msg) => `<div class="message ${msg.role}">${msg.text}</div>`)
    .join('');

  form.reset();
});

loadState();
