import {
  ChildProcess
} from 'child_process'

import spawn, {
  main,
  SpawnFactory,
  TerminationError,
  InternalError,
  InternalErrorInformation
} from '../../index'

import * as data from '../.lib/data'

type Info = SpawnFactory.TerminationInformation<ChildProcess>
type TermErr = TerminationError<ChildProcess, Info>
type ItnlErr = InternalError<ChildProcess, Error>
type ItnlErrInfo = InternalErrorInformation<ChildProcess, Error>

const redacted = '[REDACTED]'

const sanitize = (
  info: Info | ItnlErrInfo,
  {
    args = false
  }: {
    args?: boolean
  } = {}
) => ({
  ...info,
  process: {
    constructor: {
      name: info.process.constructor.name
    }
  },
  args: args ? info.args : redacted as typeof redacted
})

const sanitizeTerminationError = (error: TermErr) => ({
  ...error,
  message: redacted as typeof redacted,
  stack: redacted as typeof redacted,
  info: sanitize(error.info)
})

const sanitizeInternalError = (error: ItnlErr) => ({
  ...error,
  stack: redacted as typeof redacted,
  message: error.message,
  info: sanitize(error.info)
})

beforeEach(() => {
  jest.setTimeout(131072)
})

afterEach(() => {
  jest.setTimeout(5000)
})

it('export main as default', () => {
  expect(spawn).toBe(main)
})

describe('when executable does not exist', () => {
  const factory = () => spawn('SomethingThatDoesNotExist')

  it('onclose promise', async () => {
    const result = await factory().onclose.then(
      () => Promise.reject(new Error('factory.close should not resolve')),
      error => error
    )

    expect(sanitizeInternalError(result)).toMatchSnapshot()
  })

  it('onexit promise', async () => {
    const result = await factory().onexit.then(
      () => Promise.reject(new Error('factory.close should not resolve')),
      error => error
    )

    expect(sanitizeInternalError(result)).toMatchSnapshot()
  })
})

describe('when process terminated with non-zero status code', () => {
  const factory = () => spawn('node', [data.withNonZeroStatus], { env: { HELLO: 'WORLD' } })

  it('onclose promise', async () => {
    const result = await factory().onclose.then(
      () => Promise.reject(new Error('factory.close should not resolve')),
      error => error
    )

    expect(sanitizeTerminationError(result)).toMatchSnapshot()
  })

  it('onexit promise', async () => {
    const result = await factory().onexit.then(
      () => Promise.reject(new Error('factory.close should not resolve')),
      error => error
    )

    expect(sanitizeTerminationError(result)).toMatchSnapshot()
  })
})

describe('when process successfully terminated', () => {
  describe('with minimal arguments', () => {
    const factory = () => spawn('echo')

    it('process', () => {
      expect({
        ...factory,
        process: {
          constructor: {
            name: factory().process.constructor.name
          }
        }
      }).toMatchSnapshot()
    })

    describe('close promise', () => {
      it('onclose->process is factory.process', async () => {
        const { onclose, process } = factory()
        expect((await onclose).process).toBe(process)
      })

      it('matches snapshot', async () => {
        const { onclose } = factory()
        expect(sanitize(await onclose, { args: true })).toMatchSnapshot()
      })
    })

    describe('exit promise', () => {
      it('exit->process is factory.process', async () => {
        const { onexit, process } = factory()
        expect((await onexit).process).toBe(process)
      })

      it('matches snapshot', async () => {
        const { onexit } = factory()
        expect(sanitize(await onexit, { args: true })).toMatchSnapshot()
      })
    })
  })

  describe('with full arguments', () => {
    const factory = () => spawn('echo', ['hello', 'world'], { env: { HELLO: 'WORLD' } })

    it('onclose promise', async () => {
      expect(sanitize(await factory().onclose, { args: true })).toMatchSnapshot()
    })

    it('onexit promise', async () => {
      expect(sanitize(await factory().onexit, { args: true })).toMatchSnapshot()
    })
  })

  describe('with same event', () => {
    const factory = () => spawn('echo', ['hello', 'world'], { event: 'close' })

    it('onclose is onexit', () => {
      const { onclose, onexit } = factory()
      void expect(onclose).toBe(onexit)
    })

    it('onclose promise', async () => {
      expect(sanitize(await factory().onclose, { args: true })).toMatchSnapshot()
    })

    it('onexit promise', async () => {
      expect(sanitize(await factory().onexit, { args: true })).toMatchSnapshot()
    })
  })

  describe('with stdout and stderr', () => {
    const factory = () => spawn('node', [data.bothStdoutStderr], { env: { HELLO: 'WORLD' } })

    it('onclose promise', async () => {
      expect(sanitize(await factory().onclose)).toMatchSnapshot()
    })

    it('onexit promise', async () => {
      expect(sanitize(await factory().onexit)).toMatchSnapshot()
    })
  })

  describe('with specified stdin', () => {
    interface Callback {
      (factory: SpawnFactory<ChildProcess>): void | Promise<void>
    }

    async function run (callback: Callback) {
      const factory = spawn('bash')
      const promise = callback(factory)
      factory.process.stdin!.write('echo stdin foo\n')
      factory.process.stdin!.write('echo stderr foo 1>&2\n')
      factory.process.stdin!.write('echo stdin bar\n')
      factory.process.stdin!.write('echo stderr bar 1>&2\n')
      factory.process.stdin!.end('exit 0\n')
      await promise
    }

    const tester = (callback: Callback) => () => run(callback)

    it('close promise', tester(async factory => {
      expect(sanitize(await factory.onclose, { args: true })).toMatchSnapshot()
    }))

    it('exit promise', tester(async factory => {
      expect(sanitize(await factory.onexit, { args: true })).toMatchSnapshot()
    }))
  })
})

describe('when it does not pipe', () => {
  const factory = () => spawn(
    'node',
    [data.bothStdoutStderr],
    {
      stdio: 'ignore',
      env: { HELLO: 'WORLD' }
    }
  )

  it('stdout is empty', async () => {
    const { stdout } = await factory().onclose
    expect(stdout).toBe('')
  })

  it('stderr is empty', async () => {
    const { stderr } = await factory().onclose
    expect(stderr).toBe('')
  })
})
