import { apiSchemaValidationMiddleware } from './api-schema-validation-middleware.js'
import { responseAccessMiddleware } from './response-access-middleware.js'

export const crudToMethod = {
  '*': 'all',
  all: 'all',
  create: 'post',
  list: 'get',
  read: 'get',
  update: 'patch',
  delete: 'delete'
}

export const methodToCrud = (() => {
  const invertedObject = {}
  Object.keys(crudToMethod).forEach(key => {
    invertedObject[crudToMethod[key]] = key
  })
  return invertedObject
})()

/**
 * Takes given crudEndpoint as defined
 * @param router
 * @param crudEndpoint
 */
export function crudEndpointIntoRouter (router, crudEndpoint) {
  Object.keys(crudEndpoint).filter(k => k !== 'path').forEach(crud => {
    const endpoint = crudEndpoint[crud]
    const { get, body, handler, access = () => true } = endpoint
    const schemaValidation = apiSchemaValidationMiddleware({ get, body })

    // todo: add error middleware validator for described errors

    router[crudToMethod[crud]](crudEndpoint.path, responseAccessMiddleware(access), schemaValidation, handler)
  })
}
