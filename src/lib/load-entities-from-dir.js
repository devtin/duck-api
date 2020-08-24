import { deepScanDir } from '@pleasure-js/utils'
import { Entity } from './schema/entity.js'
import path from 'path'

/**
 * Reads given directory looking for *.js files and parses them into
 * @param dir
 */
export async function loadEntitiesFromDir (dir) {
  require = require('esm')(module)  // eslint-disable-line

  const files = await deepScanDir(dir, { only: [/\.js$/] })
  return files.map(file => {
    const entity = require(file).default || require(file)
    entity.file = path.relative(dir, file)

    try {
      return Entity.parse(entity)
    } catch (err) {
      err.file = path.relative(process.cwd(), file)
      err.errors.forEach(console.log)
      throw err
    }
  })
}
