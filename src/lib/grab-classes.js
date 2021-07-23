import { jsDirIntoJson } from 'js-dir-into-json'
import startCase from 'lodash/startCase'

export const grabClasses = async (classesPath) => {
  const gateways = await jsDirIntoJson(classesPath, {
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })
  return Object.keys(gateways).map(name => {
    return {
      name: startCase(name).replace(/\s+/g, ''),
      methods: gateways[name].methods
    }
  })
}
