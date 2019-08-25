import EventEmitter from 'events'
import { SpawnOptions } from 'child_process'
import flipPromise from '../.lib/flip-promise'

import {
  core,
  IsomorphicSpawn,
  SpawnFactory,
  InternalError,
  TerminationError
} from '../../index'

class MockedEventEmitter extends EventEmitter {
  public readonly eventSpy = jest.spyOn(this as EventEmitter, 'on')
}

class FakeStream extends MockedEventEmitter implements IsomorphicSpawn.Readable {
  public data (chunk: string) {
    this.emit('data', chunk)
    return this
  }
}

class FakeProcess extends MockedEventEmitter implements IsomorphicSpawn.Return {
  public readonly stdout = new FakeStream()
  public readonly stderr = new FakeStream()

  public exit (status: number, signal: string | null) {
    this.stdout.emit('close')
    this.stderr.emit('close')
    this.emit('close', status, signal)
    this.emit('exit', status, signal)
  }
}

function createSpawnFunc (process = new FakeProcess()) {
  const spawn: IsomorphicSpawn<FakeProcess> = () => process
  return jest.fn(spawn)
}

function setup () {
  const process = new FakeProcess()
  const spawn = createSpawnFunc(process)
  const args: Parameters<typeof spawn> = ['command', [...'args'], { stdio: 'pipe' }]
  const result = core(spawn, ...args)
  return { process, spawn, args, result }
}

describe('calls spawn', () => {
  it('once', () => {
    const { spawn } = setup()
    expect(spawn).toBeCalledTimes(1)
  })

  it('with the same arguments it was called with', () => {
    const { spawn, args } = setup()
    expect(spawn).toBeCalledWith(...args)
  })
})

describe('call .on method of process', () => {
  it('with "error" and a listener', () => {
    const { eventSpy } = setup().process
    expect(eventSpy).toBeCalledWith('error', expect.any(Function))
  })

  it('with "close" and a listener', () => {
    const { eventSpy } = setup().process
    expect(eventSpy).toBeCalledWith('close', expect.any(Function))
  })

  it('with "exit" and a listener', () => {
    const { eventSpy } = setup().process
    expect(eventSpy).toBeCalledWith('exit', expect.any(Function))
  })
})

describe('returns object', () => {
  it('that has "process" property that is returning value of spawn', () => {
    const { result, process } = setup()
    expect(result).toHaveProperty('process', process)
  })

  it('that has "onclose" property that is a promise', () => {
    const { result } = setup()
    expect(result).toHaveProperty('onclose', expect.any(Promise))
  })

  it('that has "onexit" property that is a promise', () => {
    const { result } = setup()
    expect(result).toHaveProperty('onexit', expect.any(Promise))
  })
})

describe('when some arguments is not provided', () => {
  function setup () {
    const spawn = createSpawnFunc()
    core(spawn, 'command')
    return { spawn }
  }

  it('pass empty array to spawn in places of missing "args"', () => {
    const { spawn } = setup()
    expect(spawn).toBeCalledWith(
      expect.anything(),
      [],
      expect.anything()
    )
  })

  it('pass empty object to spawn in places of missing "options"', () => {
    const { spawn } = setup()
    expect(spawn).toBeCalledWith(
      expect.anything(),
      expect.anything(),
      {}
    )
  })
})

describe('when options has "event" property', () => {
  function setupEvent (event: 'close' | 'exit') {
    const process = new FakeProcess()
    const spawn = createSpawnFunc(process)
    const result = core(spawn, 'command', [], { event })
    return { process, spawn, result }
  }

  describe('that is "close"', () => {
    it('calls .on method with "close" and a listener', () => {
      const { eventSpy } = setupEvent('close').process
      expect(eventSpy).toBeCalledWith('close', expect.any(Function))
    })

    it('does not call .on method with "exit"', () => {
      const { eventSpy } = setupEvent('close').process
      expect(eventSpy).not.toBeCalledWith('exit', expect.anything())
    })

    it('onclose and onexit is the same object', () => {
      const { onclose, onexit } = setupEvent('close').result
      void expect(onclose).toBe(onexit)
    })
  })

  describe('that is "exit"', () => {
    it('calls .on method with "exit" and a listener', () => {
      const { eventSpy } = setupEvent('exit').process
      expect(eventSpy).toBeCalledWith('exit', expect.any(Function))
    })

    it('does not call .on method with "close"', () => {
      const { eventSpy } = setupEvent('exit').process
      expect(eventSpy).not.toBeCalledWith('close', expect.anything())
    })

    it('onclose and onexit is the same object', () => {
      const { onclose, onexit } = setupEvent('exit').result
      void expect(onclose).toBe(onexit)
    })
  })
})

describe('resolve/reject', () => {
  interface Callback {
    (result: SpawnFactory<FakeProcess>): void | Promise<void>
  }

  describe('when error is emitted', () => {
    const ERROR = Symbol('ERROR')

    async function run (callback: Callback) {
      const { process, result } = setup()
      const promise = callback(result)
      process.emit('error', ERROR)
      await promise
    }

    const tester = (callback: Callback) => () => run(callback)

    describe('onclose rejects with error', () => {
      it('that is an instance of InternalError', tester(async factory => {
        await expect(factory.onclose).rejects.toBeInstanceOf(InternalError)
      }))

      describe('that has "info" property', () => {
        it('that has "error" property that is the emitted error', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('error', ERROR)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('process')
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onclose).rejects.toMatchSnapshot()
      }))
    })

    describe('onexit rejects with error', () => {
      it('that is an instance of InternalError', tester(async factory => {
        await expect(factory.onexit).rejects.toBeInstanceOf(InternalError)
      }))

      describe('that has "info" property', () => {
        it('that has "error" property that is the emitted error', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('error', ERROR)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('process')
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onclose).rejects.toMatchSnapshot()
      }))
    })

    it('onclose and onexit have the same reject reason', tester(async factory => {
      const closeReason = await flipPromise(factory.onclose)
      const exitReason = await flipPromise(factory.onexit)
      expect(closeReason).toBe(exitReason)
    }))
  })

  describe('when exit status is not 0', () => {
    const STATUS = 6
    const SIGNAL = null

    async function run (callback: Callback) {
      const { process, result } = setup()
      const promise = callback(result)
      const { stdout, stderr } = process
      stdout.data('stdout 0\n')
      stderr.data('stderr 0\n')
      stdout.data('stdout 1\n')
      stdout.data('stdout 1\n')
      stderr.data('stderr 1\n')
      stderr.data('stderr 1\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      process.exit(STATUS, SIGNAL)
      await promise
    }

    const tester = (callback: Callback) => () => run(callback)

    describe('onclose rejects with an error', () => {
      it('that is an instance of TerminationError', tester(async factory => {
        await expect(factory.onclose).rejects.toBeInstanceOf(TerminationError)
      }))

      describe('that has "info" property', () => {
        it('that has "status" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('status', STATUS)
        }))

        it('that has "signal" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('signal', SIGNAL)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('process', expect.any(FakeProcess))
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onclose).rejects.toMatchSnapshot()
      }))
    })

    describe('onexit rejects with an error', () => {
      it('that is an instance of TerminationError', tester(async factory => {
        await expect(factory.onexit).rejects.toBeInstanceOf(TerminationError)
      }))

      describe('that has "info" property', () => {
        it('that has "status" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('status', STATUS)
        }))

        it('that has "signal" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('signal', SIGNAL)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('process', expect.any(FakeProcess))
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onexit).rejects.toMatchSnapshot()
      }))
    })
  })

  describe('when exit status is not 0 and signal is not null', () => {
    const STATUS = 6
    const SIGNAL = 'signal'

    async function run (callback: Callback) {
      const { process, result } = setup()
      const promise = callback(result)
      const { stdout, stderr } = process
      stdout.data('stdout 0\n')
      stderr.data('stderr 0\n')
      stdout.data('stdout 1\n')
      stdout.data('stdout 1\n')
      stderr.data('stderr 1\n')
      stderr.data('stderr 1\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      process.exit(STATUS, SIGNAL)
      await promise
    }

    const tester = (callback: Callback) => () => run(callback)

    describe('onclose rejects with an error', () => {
      it('that is an instance of TerminationError', tester(async factory => {
        await expect(factory.onclose).rejects.toBeInstanceOf(TerminationError)
      }))

      describe('that has "info" property', () => {
        it('that has "status" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('status', STATUS)
        }))

        it('that has "signal" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('signal', SIGNAL)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toHaveProperty('process', expect.any(FakeProcess))
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onclose)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onclose).rejects.toMatchSnapshot()
      }))
    })

    describe('onexit rejects with an error', () => {
      it('that is an instance of TerminationError', tester(async factory => {
        await expect(factory.onexit).rejects.toBeInstanceOf(TerminationError)
      }))

      describe('that has "info" property', () => {
        it('that has "status" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('status', STATUS)
        }))

        it('that has "signal" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('signal', SIGNAL)
        }))

        it('that has "command" property that is a string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('command', expect.any(String))
        }))

        it('that has "args" property that is an array of string', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('args', [...'args'])
        }))

        it('that has "options" property that is an object', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('options', expect.any(Object))
        }))

        it('that has "process" property', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toHaveProperty('process', expect.any(FakeProcess))
        }))

        it('that matches snapshot', tester(async factory => {
          const reason = await flipPromise(factory.onexit)
          expect(reason.info).toMatchSnapshot({
            process: expect.any(FakeProcess)
          })
        }))
      })

      it('that matches snapshot', tester(async factory => {
        await expect(factory.onexit).rejects.toMatchSnapshot()
      }))
    })
  })

  describe('when exit status is 0', () => {
    async function run (callback: Callback) {
      const { process, result } = setup()
      const promise = callback(result)
      const { stdout, stderr } = process
      stdout.data('stdout 0\n')
      stderr.data('stderr 0\n')
      stdout.data('stdout 1\n')
      stdout.data('stdout 1\n')
      stderr.data('stderr 1\n')
      stderr.data('stderr 1\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stdout.data('stdout 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      stderr.data('stderr 2\n')
      process.exit(0, null)
      await promise
    }

    const tester = (callback: Callback) => () => run(callback)

    it('onclose', tester(async factory => {
      expect(await factory.onclose).toMatchSnapshot({
        process: expect.any(FakeProcess)
      })
    }))

    it('onexit', tester(async factory => {
      expect(await factory.onexit).toMatchSnapshot({
        process: expect.any(FakeProcess)
      })
    }))
  })
})

describe('when stdout/stderr is null', () => {
  class FakeProcess extends EventEmitter implements IsomorphicSpawn.Return {
    public readonly stdout = null
    public readonly stderr = null
  }

  interface Callback {
    (result: SpawnFactory<FakeProcess>): void | Promise<void>
  }

  function createSpawnFunc (process = new FakeProcess()) {
    const spawn: IsomorphicSpawn<FakeProcess> = () => process
    return jest.fn(spawn)
  }

  async function run (callback: Callback) {
    const process = new FakeProcess()
    const spawn = createSpawnFunc(process)
    const result = core(spawn, 'command', [], { stdio: 'ignore' })
    const promise = callback(result)
    process.emit('close', 0, null)
    process.emit('exit', 0, null)
    await promise
  }

  const tester = (callback: Callback) => () => run(callback)

  it('onclose', tester(async factory => {
    expect(await factory.onclose).toMatchSnapshot({
      process: expect.any(FakeProcess)
    })
  }))

  it('onexit', tester(async factory => {
    expect(await factory.onexit).toMatchSnapshot({
      process: expect.any(FakeProcess)
    })
  }))
})
