# MissionCRTL

Moderne MVP-Webapp für eine Workplattform mit:

- Pods (Ideen/Planungsobjekte) und Konvertierung in Projekte.
- Integrationsverwaltung für GitHub, Forgejo, Redmine, OpenProject, Signal und WhatsApp.
- Zwei Arbeitsbereiche pro User (`privat`, `arbeit`) mit Defaults.
- Signal/WhatsApp-Sniffer-Konzept inkl. `pod-source` Modus.
- Ticket-basierte Timer-Endpunkte (`start` / `stop`).
- Globale AI-Chatbox (Gemini/ChatGPT/Ollama als Provider-Konzept).

## Start

### Alles automatisch aufsetzen und starten

```bash
./start.sh
```

Das Script prüft Node/npm, versucht ein `npm install`, führt optional Tests aus und startet anschließend den Server auf `0.0.0.0:3000` (oder via `HOST`/`PORT` überschreibbar). Falls Tests fehlschlagen, startet der Server trotzdem. Mit `RUN_TESTS=0 ./start.sh` kannst du Tests überspringen.

### Manuell

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen.

## Hinweis

Diese Implementierung ist ein funktionsfähiger MVP mit In-Memory-Datenbank und simulierten Integrationen.
Für produktiven Einsatz sind OAuth/API-Clients, Persistenz, Auth, Rechtekonzept, Queueing und sichere WhatsApp-/Signal-Bridge erforderlich.
