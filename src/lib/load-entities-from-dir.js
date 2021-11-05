import { jsDirIntoJson } from 'js-dir-into-json'
import { Entity } from './schema'
import Promise from 'bluebird'

const prettyPrintError = (error) => {
  console.log(`  ${error.constructor.name}:`, error.message);
  console.log(`  - value:`, error.value)
  console.log(`  - field:`, error.field.fullPath)
  console.log('')
}

/**
 * Reads given directory looking for *.js files and parses them into
 * @param dir
 */

export async function loadEntitiesFromDir (dir) {
  require = require('esm')(module)  // eslint-disable-line

  const entities = await jsDirIntoJson(dir)

  return Promise.map(Object.entries(entities), async ([entityName, entity]) => {
    entity.name = entityName
    entity.path = `/${entityName}`

    try {
      return await Entity.parse(entity)
    } catch (err) {
      err.name = entityName
      err.errors.forEach(prettyPrintError)
      throw err
    }
  })
}
