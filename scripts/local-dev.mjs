import { spawn } from 'child_process';

const commands = [
  {
    name: 'api',
    command: 'npm',
    args: ['--prefix', 'agent-server', 'run', 'dev'],
  },
  {
    name: 'web',
    command: 'npm',
    args: ['--prefix', 'sidebar', 'run', 'dev'],
  },
];

const children = commands.map(item => {
  const child = spawn(item.command, item.args, {
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', code => {
    if (code) {
      console.error(`${item.name} 已退出，code=${code}`);
    }
  });
  return child;
});

function shutdown() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
