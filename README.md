# advanced-spawn-async

Advanced isomorphic asynchronous spawn function

## Requirements

* Node.js ≥ 8.9.0

## Usage

### Basic Usage

Usage without custom `spawn` function (i.e. Use built-in `child_process.spawn`).

```javascript
import spawn from 'advanced-spawn-async'

const {
  process, // ChildProcess
  onclose, // Promise<{ command, args, options, stdout, stderr, output, status, signal, process }>
  onexit // Promise<{ command, args, options, stdout, stderr, output, status, signal, process }>
} = spawn('node')

process.stdin.write('console.info("stdout")\n')
process.stdin.write('console.error("stderr")\n')
process.stdin.end('require("process").exit(0)\n')

onclose.then(({ stdout, stderr, output }) => {
  console.info('CLOSE', { stdout, stderr, output })
})

onexit.then(({ stdout, stderr, output }) => {
  console.info('EXIT', { stdout, stderr, output })
})
```

**Sample Output:**

```javascript
EXIT {
  stdout: 'stdout\n',
  stderr: 'stderr\n',
  output: 'stdout\nstderr\n'
}
CLOSE {
  stdout: 'stdout\n',
  stderr: 'stderr\n',
  output: 'stdout\nstderr\n'
}
```

### Custom Spawn Function

User provide custom spawn function.

```javascript
import { core } from 'advanced-spawn-async'
import spawn from 'cross-spawn'

const { process, onclose, onexit } = core(spawn, 'node')

// Similar to above example
```

## License

[MIT](https://git.io/vhaEz) © [Hoàng Văn Khải](https://github.com/KSXGitHub)
