const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, 'public');

const createId = () => Math.random().toString(36).slice(2, 10);

const db = {
  users: [
    {
      id: 'u1',
      name: 'Demo User',
      workspaces: {
        privat: {
          defaultIssueTool: 'openproject',
          defaultRepoTool: 'forgejo'
        },
        arbeit: {
          defaultIssueTool: 'redmine',
          defaultRepoTool: 'github'
        }
      }
    }
  ],
  integrations: {
    github: { connected: false },
    forgejo: { connected: false },
    redmine: { connected: false },
    openproject: { connected: false },
    signal: { connected: false },
    whatsapp: { connected: false },
    ai: { provider: 'chatgpt', connected: false }
  },
  pods: [
    {
      id: 'pod-1',
      workspace: 'arbeit',
      name: 'KI Support Cockpit',
      description: 'Ideenplattform für AI-gestützte Ticketplanung',
      files: ['scope.md'],
      status: 'idea',
      infoFeed: ['Signal: Kunde fragt nach Sprint-Roadmap'],
      tasks: [
        {
          id: 't1',
          title: 'UX Wireframe erstellen',
          dueDate: '2026-03-01',
          comments: ['Start nächste Woche']
        }
      ]
    }
  ],
  projects: [],
  timers: {}
};

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const filePath = path.join(publicDir, pathname);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  };

  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function handler(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/state') {
    sendJson(res, 200, db);
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/api/integrations/')) {
    const tool = pathname.split('/')[3];
    if (!pathname.endsWith('/connect') || !db.integrations[tool]) {
      sendJson(res, 404, { error: 'Integration unbekannt' });
      return;
    }

    const body = await readBody(req);
    db.integrations[tool] = { ...db.integrations[tool], connected: true, config: body };
    sendJson(res, 200, db.integrations[tool]);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/pods') {
    const body = await readBody(req);
    const pod = { id: createId(), status: 'idea', infoFeed: [], tasks: [], ...body };
    db.pods.push(pod);
    sendJson(res, 201, pod);
    return;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/pods\/[^/]+\/convert$/)) {
    const podId = pathname.split('/')[3];
    const pod = db.pods.find((p) => p.id === podId);
    if (!pod) {
      sendJson(res, 404, { error: 'Pod nicht gefunden' });
      return;
    }

    const body = await readBody(req);
    const project = {
      id: createId(),
      podId: pod.id,
      name: pod.name,
      description: pod.description,
      workspace: pod.workspace,
      issueTracker: body.issueTracker || null,
      repoHost: body.repoHost || null,
      external: {
        createIssueProject: Boolean(body.createIssueProject),
        createRepo: Boolean(body.createRepo)
      },
      tickets: (pod.tasks || []).map((task) => ({ ...task, type: 'ticket', externalId: `EXT-${Math.floor(Math.random() * 1000)}` })),
      infoFeed: [...(pod.infoFeed || [])]
    };

    pod.status = 'planned';
    db.projects.push(project);
    sendJson(res, 200, project);
    return;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/projects\/[^/]+\/tickets\/[^/]+\/timer$/)) {
    const [, , , projectId, , ticketId] = pathname.split('/');
    const body = await readBody(req);
    const key = `${projectId}:${ticketId}`;

    if (body.action === 'start') {
      db.timers[key] = { startTime: Date.now(), running: true };
      sendJson(res, 200, { running: true });
      return;
    }

    if (body.action === 'stop' && db.timers[key]?.running) {
      const elapsedMs = Date.now() - db.timers[key].startTime;
      db.timers[key] = { running: false, elapsedMs };
      sendJson(res, 200, { running: false, elapsedMs });
      return;
    }

    sendJson(res, 400, { error: 'Ungültige Aktion oder Timer nicht gestartet' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sniffers') {
    const body = await readBody(req);
    const sniffer = {
      id: createId(),
      mode: body.mode || 'project-info',
      channel: body.channel,
      provider: body.provider,
      boundTo: body.boundTo
    };

    const targetCollection = body.targetType === 'project' ? db.projects : db.pods;
    const target = targetCollection.find((item) => item.id === body.boundTo);
    if (!target) {
      sendJson(res, 404, { error: 'Ziel nicht gefunden' });
      return;
    }

    target.infoFeed = target.infoFeed || [];
    target.infoFeed.push(`${sniffer.provider.toUpperCase()}-Sniffer aktiv auf ${sniffer.channel} (${sniffer.mode})`);
    if (sniffer.mode === 'pod-source') {
      target.infoFeed.push('Pod-Source aktiv: Neue Ideen aus Chat werden automatisch zugeordnet.');
    }

    sendJson(res, 201, sniffer);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ai/chat') {
    const body = await readBody(req);
    const message = (body.message || '').toLowerCase();
    const podNames = db.pods.map((p) => p.name).join(', ');

    let answer = 'Ich habe noch keine Empfehlung.';
    if (message.includes('fällig') || message.includes('deadline')) {
      answer = 'Nächster Termin: UX Wireframe erstellen bis 2026-03-01.';
    } else if (message.includes('lust') || message.includes('idee')) {
      answer = `Du könntest an diesen Pods arbeiten: ${podNames}. Neue Idee: "Automatischer Weekly-Report Bot".`;
    } else if (message.includes('was muss ich')) {
      answer = 'Offen sind: UX Wireframe, Integrationstest Redmine/OpenProject und Signal-Sniffer konfigurieren.';
    }

    sendJson(res, 200, { provider: db.integrations.ai.provider, answer });
    return;
  }

  if (serveStatic(req, res)) {
    return;
  }

  sendJson(res, 404, { error: 'Nicht gefunden' });
}

http.createServer((req, res) => {
  handler(req, res).catch(() => sendJson(res, 500, { error: 'Serverfehler' }));
}).listen(port, host, () => {
  console.log(`MissionCRTL läuft auf http://${host}:${port}`);
});
