# procrastination

A cozy code editor that lovingly distracts you while the AI does the work.

Three panes (explorer · editor · AI), a bottom terminal that pops up on `Ctrl+\``,
and a sidebar that quietly opens Instagram Reels (or YouTube Shorts) the moment
Claude Code or Codex starts cooking — and closes itself when they stop to ask
you something.

Built from scratch — not a VSCode fork. Editor core is **Monaco** (the same
engine VSCode is built on, shipped standalone by Microsoft as an npm package),
which gives you the editing feel without the extension marketplace.

---

## Prereqs

- Node 20+
- Either `claude` or `codex` (or both) installed and on your `PATH` if you want
  the AI panels to actually do anything. The panels invoke the binaries
  directly through your login shell — if a binary is missing, you'll see a
  "command not found" message in the panel, not a silent failure.
- On Linux: a working X11 / Wayland session. (Electron app.)

## Run it

```bash
npm install
# node-pty is a native module — Electron has its own ABI, so rebuild once:
npx electron-rebuild -f -w node-pty
npm run dev
```

`npm run dev` starts the Vite dev server **and** launches Electron pointed at it.
Code changes hot-reload in the renderer; main-process changes restart the
Electron window automatically.

## Build a packaged app

```bash
npm run build           # produces a distributable in release/
npm run build:unpacked  # faster, leaves an unpacked tree in release/
```

## Shortcuts

| key            | what it does                                    |
| -------------- | ----------------------------------------------- |
| `Ctrl+\``       | toggle bottom terminal (just like VSCode)       |
| `Ctrl+S`       | save the active file                            |
| `Ctrl+Enter`   | run the active file using its extension mapping |
| `Ctrl+,`       | open settings                                   |

## How features work

### Explorer
Right-click any folder or use the row icons (`+` file / `+` folder / refresh).
The tree auto-refreshes whenever something on disk changes — so when Claude
or Codex creates a file, you'll see it appear.

### Editor
Monaco with a custom cozy theme (warm light and warm dark). Open tabs across
the top. When the AI edits a file you have open, the buffer updates silently;
if you had unsaved changes, you get a small "this file changed on disk" banner
with a choice to reload or keep yours.

### Run button
Top-right of the editor. Reads the active file's extension, looks it up in
`settings → run commands`, and runs the resolved command in the bottom terminal.

Templates use these tokens:

| token       | expands to                                  |
| ----------- | ------------------------------------------- |
| `$file`     | full absolute path                          |
| `$fileName` | filename with extension                     |
| `$fileBase` | filename without extension                  |
| `$ext`      | extension including the dot (`.cpp`)        |
| `$dir`      | directory containing the file               |

Example for `.cpp`:

```
gcc -O2 -std=c++20 "$file" -o "$dir/$fileBase" && "$dir/$fileBase"
```

### Terminals
Three kinds, all real PTYs via `node-pty`:

1. **Bottom terminal** — `Ctrl+\``. Multi-tab; matches your default shell.
2. **Claude Code** — right panel, tab "claude code". Runs `claude` in your
   shell environment. Toggle the **bypass** pill to launch with
   `--dangerously-skip-permissions`.
3. **Codex** — right panel, tab "codex". Runs `codex`. The bypass pill maps to
   `--dangerously-bypass-approvals-and-sandbox`.

Toggling bypass restarts the AI's PTY. You're asked to confirm the first time
you turn it on, because it's a real foot-gun outside trusted dirs.

### Break-time browser sidebar
While Claude or Codex is actively streaming output, an embedded browser slides
in on the right with **Instagram Reels** (default) or **YouTube Shorts**.

Switch provider with the IG/YT pills, or pin it open / disable auto-mode with
the pin icon. The detector is heuristic:

- Output streaming → "working" → browser opens.
- Output silent ≥ ~1.8s with a prompt-shaped tail (`?`, `>`, `❯`, "y/n") or
  silent ≥ ~4.5s → "idle" → browser closes.

It's not perfect — neither Claude Code nor Codex emit a clean "awaiting input"
event — but it gets the common case right. Manually closing the sidebar (the X
button) pins manual mode for the rest of the session.

### Settings
`Ctrl+,` opens a modal where you can:

- swap themes (warm-light / warm-dark)
- swap browser provider and toggle auto-open
- toggle per-AI bypass permissions
- add / edit / remove run commands per extension

Settings live in your OS user-data dir (`~/.config/Procrastination/settings.json`
on Linux).

## Things I deliberately did NOT build

This is a lean MVP. The following were out of scope:

- **VSCode extension compatibility.** Reimplementing the VSCode extension host
  from scratch (without forking) is a multi-engineer-year effort — that's
  literally what Eclipse Theia is. You get Monaco's editing experience (syntax,
  themes, IntelliSense via standard LSP if/when wired in) but no marketplace.
- **LSP integration.** The plumbing is structured so it can plug in cleanly
  (look at `language-map.ts`), but no language server is wired up yet.
- **Debugger / DAP.**
- **Git UI.**
- **Search-in-files.** Monaco does in-file search; cross-file search isn't here.

If/when you want any of those, they can be added without breaking what's here.

## Known limitations

- **Instagram embedded login.** Instagram aggressively blocks embedded
  webviews. The first time you open the IG sidebar, it'll likely show a login
  wall. Sign in once inside the panel — cookies persist via the `persist:browse`
  partition. If it keeps fighting back, switch the default to YouTube in
  settings.
- **AI activity detection** is a heuristic. If your AI prints continuously and
  never produces a recognizable prompt, the browser will stay open longer than
  intended. If your AI is super chatty mid-task with long pauses, the browser
  might flicker.
- **node-pty native bindings.** If you upgrade Electron, run `npx
  electron-rebuild -f -w node-pty` again or `node-pty` will refuse to load.

## Project layout

```
electron/                 main process (Node)
  main.ts                 window, IPC handlers (fs, pty, settings)
  preload.ts              context-isolated bridge → window.api
  pty-manager.ts          node-pty wrapper

src/                      renderer (React)
  App.tsx                 boot, hotkeys, theme application
  components/
    Layout.tsx            three-pane + bottom + browser
    TitleBar.tsx          top bar
    Explorer.tsx          tree, CRUD, watcher
    EditorPane.tsx        Monaco + tabs + run/save
    Terminal.tsx          xterm.js + PTY glue
    BottomTerminal.tsx    Ctrl+` panel
    AIPanel.tsx           Claude / Codex tabs + activity detector
    BrowserSidebar.tsx    embedded webview
    SettingsModal.tsx     theme / provider / bypass / run commands
    WelcomeScreen.tsx     no-folder state
  lib/
    store.ts              zustand store
    ai-activity.ts        the "AI is working" heuristic
    language-map.ts       extension → monaco language id
    run-command.ts        template token expansion
  styles/globals.css      theme tokens (warm light + warm dark)
```
