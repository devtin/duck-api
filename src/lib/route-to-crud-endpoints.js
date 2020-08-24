import { CRUDEndpoint } from './schema/crud-endpoint.js'
import { CRUD } from './schema/crud.js'
import { isNotNullObj } from './is-not-null-obj.js'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import { convertToPath } from './utils/convert-to-path'

export function routeToCrudEndpoints (routeTree = {}, parentPath = []) {
  const endpoints = []
  if (isNotNullObj(routeTree)) {
    Object.keys(routeTree).forEach(propName => {
      if (propName === '0') {
        throw new Error('reached')
      }
      const value = routeTree[propName]
      const possibleMethod = pick(value, CRUD.ownPaths)

      if (propName === 'someMethod') {
        CRUD.parse(possibleMethod)
      }

      if (CRUD.isValid(possibleMethod)) {
        const path = `/${parentPath.concat(propName).map(convertToPath).join('/')}`
        endpoints.push(CRUDEndpoint.parse(Object.assign({
          path
        }, possibleMethod)))
        endpoints.push(...routeToCrudEndpoints(omit(value, CRUD.ownPaths), parentPath.concat(propName)))
        return
      }
      endpoints.push(...routeToCrudEndpoints(value, parentPath.concat(propName)))
    })
  }
  return endpoints.filter(Boolean).sort((endpointA, endpointB) => {
    return endpointA.path.indexOf(':') - endpointB.path.indexOf(':')
  })
}
