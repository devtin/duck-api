import path from 'path'
import { deepScanDir } from '@pleasure-js/utils'
import { CRUDEndpoint } from './schema'

/**
 * Look for JavaScript files in given directory
 *
 * @param {String} dir - The directory to look for files
 * @return {CRUDEndpoint[]}
 */

export async function loadApiCrudDir (dir) {
  require = require('esm')(module);  // eslint-disable-line

  return (await deepScanDir(dir, { only: [/\.js$/] })).map((file) => {
    const fileRelativePath = path.relative(process.cwd(), file)
    const apiRelativePath = path.relative(dir, file)

    const required = Object.assign(require(file).default || require(file), {
      path: (`/` + apiRelativePath.replace(/\.js$/, '')).replace(/\/_/g, '/:').replace(/\/index$/, '')
    })

    try {
      return CRUDEndpoint.parse(required)
    } catch (err) {
      err.file = fileRelativePath
      throw err
    }
  }).filter(Boolean).sort((a, b) => {
    return a > b ? 1 : -1
  })
}
