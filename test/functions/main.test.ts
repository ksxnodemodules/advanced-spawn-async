import {
  ChildProcess
} from 'child_process'

import spawn, {
  main,
  SpawnFactory
} from '../../index'

import * as data from '../.lib/data'
import flipPromise from '../.lib/flip-promise'

beforeEach(() => {
  jest.setTimeout(131072)
})

afterEach(() => {
  jest.setTimeout(5000)
})

it.skip('export main as default', () => {
  expect(spawn).toBe(main)
})

describe('when executable does not exist', () => {
  const factory = () => spawn('SomethingThatDoesNotExist')

  it.skip('onclose promise', async () => {
    const result = await flipPromise(factory().onclose)

    expect({ ...result }).toMatchSnapshot({
      info: {
        process: expect.anything()
      }
    })
  })

  it.skip('onexit promise', async () => {
    const result = await flipPromise(factory().onexit)

    expect({ ...result }).toMatchSnapshot({
      info: {
        process: expect.anything()
      }
    })
  })
})

describe('when process terminated with non-zero status code', () => {
  const factory = () => spawn('node', [data.withNonZeroStatus], { env: { HELLO: 'WORLD' } })

  it.skip('onclose promise', async () => {
    const result = await flipPromise(factory().onclose)

    expect({ ...result }).toMatchSnapshot({
      info: {
        args: [expect.any(String)],
        process: expect.anything()
      }
    })
  })

  it.skip('onexit promise', async () => {
    const result = await flipPromise(factory().onexit)

    expect({ ...result }).toMatchSnapshot({
      info: {
        args: [expect.any(String)],
        process: expect.anything()
      }
    })
  })
})

describe('when process successfully terminated', () => {
  describe('with minimal arguments', () => {
    const factory = () => spawn('echo')

    it.skip('process', () => {
      expect(factory()).toMatchSnapshot({
        process: expect.anything()
      })
    })

    describe('close promise', () => {
      it.skip('onclose->process is factory.process', async () => {
        const { onclose, process } = factory()
        expect((await onclose).process).toBe(process)
      })

      it.skip('matches snapshot', async () => {
        const { onclose } = factory()
        expect(await onclose).toMatchSnapshot({
          process: expect.anything()
        })
      })
    })

    describe('exit promise', () => {
      it.skip('exit->process is factory.process', async () => {
        const { onexit, process } = factory()
        expect((await onexit).process).toBe(process)
      })

      it.skip('matches snapshot', async () => {
        const { onexit } = factory()
        expect(await onexit).toMatchSnapshot({
          process: expect.anything()
        })
      })
    })
  })

  describe('with full arguments', () => {
    const factory = () => spawn('echo', ['hello', 'world'], { env: { HELLO: 'WORLD' } })

    it.skip('onclose promise', async () => {
      expect(await factory().onclose).toMatchSnapshot({
        process: expect.anything()
      })
    })

    it.skip('onexit promise', async () => {
      expect(await factory().onexit).toMatchSnapshot({
        process: expect.anything()
      })
    })
  })

  describe('with same event', () => {
    const factory = () => spawn('echo', ['hello', 'world'], { event: 'close' })

    it.skip('onclose is onexit', () => {
      const { onclose, onexit } = factory()
      void expect(onclose).toBe(onexit)
    })

    it.skip('onclose promise', async () => {
      expect(await factory().onclose).toMatchSnapshot({
        process: expect.anything()
      })
    })

    it.skip('onexit promise', async () => {
      expect(await factory().onexit).toMatchSnapshot({
        process: expect.anything()
      })
    })
  })

  describe('with stdout and stderr', () => {
    const factory = () => spawn('node', [data.bothStdoutStderr], { env: { HELLO: 'WORLD' } })

    it.skip('onclose promise', async () => {
      expect(await factory().onclose).toMatchSnapshot({
        args: [expect.any(String)],
        process: expect.anything()
      })
    })

    it.skip('onexit promise', async () => {
      expect(await factory().onexit).toMatchSnapshot({
        args: [expect.any(String)],
        process: expect.anything()
      })
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

    it.skip('close promise', tester(async factory => {
      expect(await factory.onclose).toMatchSnapshot({
        process: expect.anything()
      })
    }))

    it.skip('exit promise', tester(async factory => {
      expect(await factory.onexit).toMatchSnapshot({
        process: expect.anything()
      })
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

  it.skip('stdout is empty', async () => {
    const { stdout } = await factory().onclose
    expect(stdout).toBe('')
  })

  it.skip('stderr is empty', async () => {
    const { stderr } = await factory().onclose
    expect(stderr).toBe('')
  })
})
