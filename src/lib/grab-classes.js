import { jsDirIntoJsonIfExists } from './utils/js-dir-into-json-if-exists.js'
import startCase from 'lodash/startCase'

export const grabClasses = async (classesPath) => {
  const gateways = await jsDirIntoJsonIfExists(classesPath, {
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })
  return Object.keys(gateways).map(name => {
    return {
      name: startCase(name).replace(/\s+/g, ''),
      methods: gateways[name].methods
    }
  })
}
