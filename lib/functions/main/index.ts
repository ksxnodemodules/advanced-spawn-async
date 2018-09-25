import { spawn } from 'child_process'
import { Options } from '../../types'
import callSpawn from '../core'

export = (command: string, args?: string[], options?: Options) =>
  callSpawn(spawn, command, args, options)
