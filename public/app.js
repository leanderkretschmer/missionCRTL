const state = {
  pods: [],
  projects: [],
  integrations: {},
  user: null
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Fehler');
  }

  return response.json();
}

function renderWorkspaceDefaults() {
  const el = document.getElementById('workspaceDefaults');
  const workspaces = state.user?.workspaces || {};
  el.innerHTML = Object.entries(workspaces)
    .map(
      ([name, cfg]) =>
        `<div><strong>${name}</strong><br><small>Issue-Default: ${cfg.defaultIssueTool} | Repo-Default: ${cfg.defaultRepoTool}</small></div>`
    )
    .join('');
}

function renderIntegrations() {
  document.getElementById('integrationState').textContent = JSON.stringify(state.integrations, null, 2);
}

function renderPods() {
  const list = document.getElementById('podList');
  list.innerHTML = state.pods
    .map(
      (pod) => `
      <div class="pod">
        <strong>${pod.name}</strong> <small>(${pod.id})</small>
        <p>${pod.description || ''}</p>
        <small>Status: ${pod.status}</small>
        <div class="button-row">
          <button onclick="convertPod('${pod.id}', 'redmine', 'github')">Zu Projekt (Redmine + GitHub)</button>
          <button onclick="convertPod('${pod.id}', 'openproject', 'forgejo')">Zu Projekt (OpenProject + Forgejo)</button>
        </div>
      </div>
    `
    )
    .join('');
}

async function loadState() {
  const data = await api('/api/state');
  state.pods = data.pods;
  state.projects = data.projects;
  state.integrations = data.integrations;
  state.user = data.users[0];
  renderWorkspaceDefaults();
  renderIntegrations();
  renderPods();
}

async function connectTool(tool) {
  await api(`/api/integrations/${tool}/connect`, {
    method: 'POST',
    body: JSON.stringify({ connectedAt: new Date().toISOString() })
  });
  await loadState();
}

async function convertPod(podId, issueTracker, repoHost) {
  await api(`/api/pods/${podId}/convert`, {
    method: 'POST',
    body: JSON.stringify({
      issueTracker,
      repoHost,
      createIssueProject: true,
      createRepo: true
    })
  });
  await loadState();
  alert('Pod wurde zum Projekt konvertiert. Tickets können jetzt gestartet/gestoppt werden.');
}

window.convertPod = convertPod;

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await connectTool(btn.dataset.tool);
    } catch (err) {
      alert(err.message);
    }
  });
});

document.getElementById('podForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/pods', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    await loadState();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('snifferForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target).entries());
  try {
    const result = await api('/api/sniffers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    document.getElementById('snifferResult').textContent = `Sniffer ${result.id} aktiv.`;
    await loadState();
  } catch (err) {
    document.getElementById('snifferResult').textContent = err.message;
  }
});

document.getElementById('aiForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target).entries());
  try {
    const result = await api('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    document.getElementById('aiAnswer').textContent = `[${result.provider}] ${result.answer}`;
  } catch (err) {
    document.getElementById('aiAnswer').textContent = err.message;
  }
});

loadState();
