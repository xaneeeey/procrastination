import TerminalView from './Terminal';

type AiKind = 'claude' | 'codex';

const AI_LABEL: Record<AiKind, string> = {
  claude: 'claude',
  codex: 'codex',
};

const AI_BIN: Record<AiKind, string> = {
  claude: 'claude',
  codex: 'codex',
};

function bypassFlag(kind: AiKind): string[] {
  if (kind === 'claude') return ['--dangerously-skip-permissions'];
  if (kind === 'codex') return ['--dangerously-bypass-approvals-and-sandbox'];
  return [];
}

export default function AiTerminal({
  kind, nonce, bypass, cwd, onData, onInput, onExit,
}: {
  kind: AiKind;
  nonce: number;
  bypass: boolean;
  cwd?: string;
  onData?: (c: string) => void;
  onInput?: (c: string) => void;
  onExit?: (code: number) => void;
}) {
  const isWin = window.api.app.platform === 'win32';
  const flags = bypass ? bypassFlag(kind).join(' ') : '';
  const bin   = AI_BIN[kind];
  const cmd   = `${bin}${flags ? ' ' + flags : ''}; echo; echo "[${AI_LABEL[kind]} exited — press enter]"; read; exec bash -l`;

  const shellArgs = isWin
    ? ['-NoLogo', '-Command', cmd]
    : ['-lc', cmd];

  return (
    <TerminalView
      id={`ai-${kind}-${nonce}`}
      shell={isWin ? 'powershell.exe' : '/bin/bash'}
      args={shellArgs}
      cwd={cwd}
      onData={onData}
      onInput={onInput}
      onExit={onExit}
    />
  );
}
