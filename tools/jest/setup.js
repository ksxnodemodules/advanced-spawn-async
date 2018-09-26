'use strict'
const childProcess = require('child_process')
const realSpawn = childProcess.spawn
const KEEPER = Symbol('KEEPER')
let keeper = Promise.resolve(KEEPER)

const nodeLocation = require('child_process').spawnSync(
  'which', ['node'], { encoding: 'utf8' }
).stdout

console.log({nodeLocation})

console.log(
  'PATH',
  (require('process').env.PATH || '').split(require('path').delimiter)
)

const FakeChildProcess = class ChildProcess {}

childProcess.spawn = (...args) => {
  const promise = keeper.then(() => realSpawn(...args))

  keeper = promise.then(process => new Promise(resolve => {
    const listener = () => setTimeout(() => resolve(KEEPER), 100)
    process.on('exit', listener)
    process.on('error', listener)
  }))

  const result = {
    on (...args) {
      promise.then(process => process.on(...args))
      return result
    },

    stdin: {
      write (...args) {
        promise.then(process => process.stdin.write(...args))
        return result.stdin
      },

      end (...args) {
        promise.then(process => process.stdin.end(...args))
        return result.stdin
      },

      on (...args) {
        promise.then(process => process.stdin.on(...args))
        return result.stdin
      }
    },

    stdout: {
      on (...args) {
        promise.then(process => process.stdout.on(...args))
        return result.stdout
      }
    },

    stderr: {
      on (...args) {
        promise.then(process => process.stderr.on(...args))
        return result.stderr
      }
    },

    __proto__: new FakeChildProcess()
  }

  return result
}
