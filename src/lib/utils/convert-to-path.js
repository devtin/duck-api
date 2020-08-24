import trim from 'lodash/trim'
import kebabCase from 'lodash/kebabCase'

export function convertToPath (dirPath) {
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_/.test(name) ? ':' : ''
    return propPrefix + kebabCase(name)
  }).join('/')
}
