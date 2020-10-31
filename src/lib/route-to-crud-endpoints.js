import { CRUDEndpoint, CRUD } from './schema'
import { isNotNullObj } from './is-not-null-obj.js'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import { convertToPath } from './utils/convert-to-path'
import Promise from 'bluebird'

export async function routeToCrudEndpoints (routeTree = {}, parentPath = []) {
  const endpoints = []
  if (isNotNullObj(routeTree)) {
    await Promise.each(Object.keys(routeTree), async propName => {
      if (propName === '0') {
        throw new Error('reached')
      }
      const value = routeTree[propName]
      const possibleMethod = pick(value, CRUD.ownPaths)

      if (await CRUD.isValid(possibleMethod)) {
        const path = `/${parentPath.concat(propName).map(convertToPath).join('/')}`
        endpoints.push(await CRUDEndpoint.parse(Object.assign({
          path
        }, possibleMethod)))
        endpoints.push(...await routeToCrudEndpoints(omit(value, CRUD.ownPaths), parentPath.concat(propName)))
        return
      }
      endpoints.push(...await routeToCrudEndpoints(value, parentPath.concat(propName)))
    })
  }
  return endpoints.filter(Boolean).sort((endpointA, endpointB) => {
    return endpointA.path.indexOf(':') - endpointB.path.indexOf(':')
  })
}
