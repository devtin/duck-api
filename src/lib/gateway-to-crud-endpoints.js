import kebabCase from 'lodash/kebabCase'
import { CRUDEndpoint } from './schema'
import Promise from 'bluebird'

export const methodToCrud = {
  post: 'create',
  get: 'read',
  patch: 'update',
  delete: 'delete'
}

export function gatewayToCrudEndpoints(client) {
  return Promise.map(Object.keys(client.methods), async methodName => {
    const method = client.methods[methodName]
    methodName = kebabCase(methodName)

    return CRUDEndpoint.parse({
      path: `/${kebabCase(client.name)}/${methodName}`,
      [methodToCrud[method.verb || 'post']]: {
        description: method.description,
        body: method.input,
        output: method.output,
        async handler (ctx) {
          ctx.body = await method.handler(ctx.$pleasure.body)
        }
      }
    })
  })
}
