import trim from 'lodash/trim'
import kebabCase from 'lodash/kebabCase'

export function convertToDot (dirPath) {
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_+/.test(name) ? name.match(/^_+/)[0] : ''
    return propPrefix + kebabCase(name)
  }).join('.')
}
