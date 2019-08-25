import { IsomorphicSpawn, SpawnFactory, Options } from '../../types'
import { TerminationError, InternalError } from '../../classes'

function callSpawn<
  Process extends IsomorphicSpawn.Return
> (
  spawn: IsomorphicSpawn<Process>,
  command: string,
  args: string[] = [],
  options: Options = {}
): SpawnFactory<Process> {
  type Info = SpawnFactory.TerminationInformation<Process>

  const process = spawn(command, args, options)

  let stdout = ''
  let stderr = ''
  let output = ''

  // NOTE: Use optional chaining when it is implemented in TypeScript
  process.stdout && process.stdout.on('data', chunk => {
    stdout += chunk
    output += chunk
  })

  // NOTE: Use optional chaining when it is implemented in TypeScript
  process.stderr && process.stderr.on('data', chunk => {
    stderr += chunk
    output += chunk
  })

  const mkinfo = (status: number, signal: string | null): Info => ({
    command,
    args,
    options,
    stdout,
    stderr,
    output,
    status,
    signal,
    process
  })

  const onerror = new Promise<InternalError<Process, Error>>(resolve => {
    process.on('error', error => resolve(new InternalError({
      command,
      args,
      options,
      process,
      error
    })))
  })

  const createPromise = (event: Options.TerminationEvent) => new Promise<Info>((resolve, reject) => {
    void onerror.then(error => reject(error))

    process.on(event, (status, signal) => {
      const info = mkinfo(status, signal)

      if (status) {
        reject(new TerminationError(info))
      } else {
        resolve(info)
      }
    })
  })

  const [onclose, onexit] = (() => {
    const { event } = options

    if (event) {
      const promise = createPromise(event)
      return [promise, promise]
    } else {
      return [
        createPromise('close'),
        createPromise('exit')
      ]
    }
  })()

  function silentPromiseRejection (promise: Promise<any>) {
    void promise.catch(() => null)
  }

  return {
    get onclose () {
      silentPromiseRejection(onexit)
      return onclose
    },
    get onexit () {
      silentPromiseRejection(onclose)
      return onexit
    },
    process
  }
}

export = callSpawn
