import startCase from 'lodash/startCase'
import { duckfficerMethod } from 'duckfficer-method'
import { jsDirIntoJsonIfExistsSync } from './utils/js-dir-into-json-if-exists.js'

export const methodsToDuckfficer = (methods) => {
  const methodsObj = {}

  Object.keys(methods).forEach((methodName) => {
    const method = duckfficerMethod(methods[methodName])
    methodsObj[methodName] = async (...payload) => {
      try {
        const { output } = await method(...payload)
        return output
      } catch (error) {
        throw error.originalError
      }
    }
  })

  return methodsObj
}

export const classesToObj = (classesArray) => {
  return classesArray.reduce((objClass, currentClass) => {
    return Object.assign(objClass, {
      [currentClass.name]: methodsToDuckfficer(currentClass.methods)
    })
  }, {})
}

export const grabClassesSync = (classesPath) => {
  const gateways = jsDirIntoJsonIfExistsSync(classesPath, {
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })
  return Object.keys(gateways).map(name => {
    return {
      name: startCase(name).replace(/\s+/g, ''),
      methods: gateways[name].methods
    }
  })
}
