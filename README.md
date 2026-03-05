<p align="center">
  <img src="resources/icon.png" alt="VibeGrid" width="128" />
</p>

<h1 align="center">VibeGrid</h1>

<p align="center">
  <strong>Stage Manager for AI Coding Agents</strong>
</p>

<p align="center">
  Run multiple AI agents side by side. Manage terminals, automate workflows, and ship faster.
</p>

<p align="center">
  <a href="https://github.com/jcanizalez/vibegrid/releases"><img src="https://img.shields.io/github/v/release/jcanizalez/vibegrid?style=flat-square" alt="Release"></a>
  <a href="https://github.com/jcanizalez/vibegrid/blob/main/LICENSE"><img src="https://img.shields.io/github/license/jcanizalez/vibegrid?style=flat-square" alt="License"></a>
  <a href="https://github.com/jcanizalez/vibegrid/stargazers"><img src="https://img.shields.io/github/stars/jcanizalez/vibegrid?style=flat-square" alt="Stars"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
</p>

<p align="center">
  <a href="#install">Install</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#supported-agents">Agents</a> &middot;
  <a href="#development">Development</a>
</p>

---

<!-- SCREENSHOT_HERO: Replace with a full-window screenshot of VibeGrid in action -->
<p align="center">
  <img src="docs/screenshots/hero.png" alt="VibeGrid screenshot" width="800" />
</p>

## Why VibeGrid?

Modern development means running Claude, Copilot, Codex, and other agents across multiple projects at once. Switching between terminal windows is slow and chaotic.

VibeGrid gives you a grid-based terminal manager purpose-built for AI agents. See all your agents at a glance, automate repetitive prompts, and keep everything organized by project.

## Install

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/jcanizalez/vibegrid/main/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/jcanizalez/vibegrid/main/install.ps1 | iex
```

**Homebrew (macOS):**

```bash
brew tap jcanizalez/tap && brew install --cask vibegrid
```

Or download directly from [GitHub Releases](https://github.com/jcanizalez/vibegrid/releases).

## Features

### Multi-Agent Grid

Run Claude, Copilot, Codex, OpenCode, and Gemini in a responsive grid layout. Resize, reorder, minimize, and filter by status.

<!-- SCREENSHOT: Grid view with multiple agents running -->
<p align="center">
  <img src="docs/screenshots/grid.png" alt="Multi-agent grid" width="700" />
</p>

### Workflow Automation

Create multi-step workflows that run prompts across agents with configurable delays. Schedule them to run once or on a cron schedule.

<!-- SCREENSHOT: Workflow editor with scheduled actions -->
<p align="center">
  <img src="docs/screenshots/workflows.png" alt="Workflow automation" width="700" />
</p>

### Project Management

Organize sessions by project. Quick-launch agents from the sidebar with custom icons and colors.

<!-- SCREENSHOT: Sidebar with projects and active sessions -->
<p align="center">
  <img src="docs/screenshots/projects.png" alt="Project management" width="700" />
</p>

### Git Integration

View diffs, track file changes, and commit directly from the terminal session.

<!-- SCREENSHOT: Git diff sidebar -->
<p align="center">
  <img src="docs/screenshots/git.png" alt="Git integration" width="700" />
</p>

### Remote Hosts

Launch terminals on remote machines via SSH. Manage local and remote sessions from one place.

<!-- SCREENSHOT: Remote host configuration -->
<p align="center">
  <img src="docs/screenshots/remote.png" alt="Remote hosts" width="700" />
</p>

## Supported Agents

| Agent | Command |
|-------|---------|
| Claude Code | `claude` |
| GitHub Copilot | `gh copilot` |
| OpenAI Codex | `codex` |
| OpenCode | `opencode` |
| Google Gemini | `gemini` |

## Development

**Prerequisites:** Node.js 20+, Yarn

```bash
# Install dependencies
yarn install

# Start in development mode
yarn dev

# Build for production
yarn build

# Package for your platform
yarn dist
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

## License

[MIT](LICENSE) - Javier Canizalez
