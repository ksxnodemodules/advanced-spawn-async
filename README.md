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
  console.log('CLOSE', { stdout, stderr, output })
})

onexit.then(({ stdout, stderr, output }) => {
  console.log('EXIT', { stdout, stderr, output })
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

// The rest is like the above example
```

### Provide Arguments and Options

```javascript
import spawn from 'advanced-spawn-async'
const { onclose } = spawn('echo', ['hello'], { stdio: 'inherit', event: 'close' })
onclose.then(status => console.log({status}))
```

### Non-Zero Status Code

When process returns non-zero code.

```javascript
import spawn from 'advanced-spawn-async'
const { process, onclose } = spawn('node', [], { event: 'close' })
process.stdin.end('process.exit(123)\n')
onclose.catch(error => console.log(error.info))
```

## License

[MIT](https://git.io/vhaEz) © [Hoàng Văn Khải](https://github.com/KSXGitHub)
