import kebabCase from 'lodash/kebabCase'
import { Duckfficer } from 'duck-storage'
import { CRUDEndpoint } from './schema'
import { methodToCrud } from './crud-endpoint-into-router'
import Promise from 'bluebird'

const { Schema, Utils } = Duckfficer

const deeplyChangeSetting = (schema, settings) => {
  Object.assign(schema._settings, settings)
  schema.children.forEach(child => {
    deeplyChangeSetting(child, settings)
  })
}

/**
 * @param entity
 * @param {Object} duckRack
 * @return Promise<[]|*>
 */
export async function duckRackToCrudEndpoints (entity, duckRack) {
  const crudEndpoints = []

  const updateSchema = Schema.cloneSchema({
    schema: entity.duckModel.originalSchema
  })

  deeplyChangeSetting(updateSchema, {
    required: false,
    default: undefined
  })

  // add create, update and list methods
  crudEndpoints.push(await CRUDEndpoint.parse({
    path: entity.path,
    create: {
      description: `creates ${entity.name}`,
      access: entity.access.create,
      body: entity.duckModel.schema,
      output: entity.duckModel.schema,
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.create(ctx.$pleasure.body, ctx.$pleasure.state)
      }
    },
    read: {
      access: entity.access.list,
      description: `finds many ${entity.name} by complex query`,
      output: new Schema({ type: Array, arraySchema: entity.duckModel.schema }),
      get: {
        query: {
          type: Object,
          mapSchema: 'Query',
          required: false,
          cast (v) {
            if (typeof v === 'string') {
              try {
                v = JSON.parse(v)
              } catch (err) {
                // shh
              }
            }
            return v
          }
        },
        sort: {
          type: 'Sort',
          required: false
        },
      },
      async handler (ctx, next) {
        const { state, get: { sort } } = ctx.$pleasure
        const doc = await duckRack.list(ctx.$pleasure.get.query, {  state, sort })
        if (!doc) {
          return next()
        }
        ctx.$pleasure.response = doc
      }
    },
    update: {
      description: `updates multiple ${entity.name}`,
      access: entity.access.update,
      get: {
        type: 'Query'
      },
      body: updateSchema,
      output: new Schema({ type: Array, arraySchema: entity.duckModel.schema }),
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.update(ctx.$pleasure.get, ctx.$pleasure.body, ctx.$pleasure.state)
      }
    },
    delete: {
      description: `deletes multiple ${entity.name}`,
      access: entity.access.delete,
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.delete(ctx.$pleasure.get, ctx.$pleasure.state)
      }
    }
  }))

  if (duckRack.methods) {
    await Promise.each(Object.keys(duckRack.methods), async methodName => {
      const thePath = `${ entity.path }/${ kebabCase(methodName) }`
      const { input, output, handler, description = `method ${methodName}` } = duckRack.methods[methodName]
      const { access, verb = 'post' } = Utils.find(duckRack, `_methods.${methodName}`) || {}

      crudEndpoints.push(await CRUDEndpoint.parse({
        path: thePath,
        [methodToCrud[verb]]: {
          access,
          description,
          get: verb === 'get' ? input : undefined,
          body: verb !== 'get' ? input : undefined,
          output,
          async handler (ctx) {
            ctx.$pleasure.response = await handler.call(duckRack, ctx.$pleasure[verb === 'get' ? 'get' : 'body'], { state: ctx.$pleasure.state })
          }
        }
      }))
    })
  }

  // add read, update and delete methods
  crudEndpoints.push(await CRUDEndpoint.parse({
    path: `${ entity.path }/:id`,
    read: {
      // get: pickSchema, // todo: add pick schema
      access: entity.access.read,
      description: `reads one ${entity.name} by id`,
      async handler (ctx, next) {
        const doc = await duckRack.read(ctx.params.id, ctx.$pleasure.state)
        if (!doc) {
          return next()
        }
        ctx.$pleasure.response = doc
      },
      output: entity.duckModel.schema
    },
    update: {
      access: entity.access.update,
      description: `updates one ${entity.name} by id`,
      // get: pickSchema
      body: updateSchema,
      async handler (ctx) {
        ctx.$pleasure.response = (await duckRack.update(ctx.params.id, ctx.$pleasure.body, ctx.$pleasure.state))[0]
      },
      output: entity.duckModel.schema
    },
    delete: {
      access: entity.access.delete,
      description: `deletes one ${entity.name} by id`,
      async handler (ctx) {
        ctx.$pleasure.response = (await duckRack.delete(ctx.params.id, ctx.$pleasure.state))[0]
      },
      output: entity.duckModel.schema
    }
  }))

  // add find endpoint in order to be able to share complex queries
/*
  crudEndpoints.push(await CRUDEndpoint.parse({
    path: `${ entity.path }/find`,
    create: {
      access: entity.access.read,
      description: `finds many ${entity.name} by complex query`,
      // todo: should I also add get: { type: Query } ?
      body: {
        type: 'Query'
      },
      get: {
        query: {
          type: 'Query',
          required: false
        },
        sort: {
          type: 'Sort',
          required: false
        },
      },
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.list(ctx.$pleasure.get.query, ctx.$pleasure.get.sort)
      }
    }
  }))
*/

  const registerMethods = async (methods = {}, parentPath = '') => {
    return Promise.each(Object.keys(methods), async methodName => {
      const method = methods[methodName]
      const dotPath2Path = (dotPath = '') => {
        return dotPath.split(/\./g).map(kebabCase).join('/')
      }
      const methodPath = dotPath2Path(parentPath)
      const crudEndpointPayload = {
        path: `${ entity.path }/:id/${methodPath}${ parentPath ? '/' : ''}${ kebabCase(methodName) }`,
        [methodToCrud[method.verb || 'post']]: {
          example: method.example,
          description: method.description || `method ${methodName}`,
          get: {
            _v: {
              type: Number,
              required: false
            }
          },
          body: Utils.find(method, 'data.router.input') || method.input,
          output: Utils.find(method, 'data.router.output') || method.output,
          async handler (ctx) {
            const { id } = ctx.params
            const { _v } = ctx.$pleasure.get
            const getPayload = async () => {
              if (Utils.find(method, 'data.router.handler')) {
                return method.data.router.handler(ctx.$pleasure.body, ctx)
              }
              return ctx.$pleasure.body
            }
            const getValidate = () => {
              const validator = Utils.find(method, 'data.router.validate')
              if (validator) {
                return (doc) => {
                  return validator(doc, ctx)
                }
              }
            }
            const payload = await getPayload()
            const validate = getValidate()
            const applyPayload = { id, _v, path: methodPath, method: methodName, payload, validate, state: ctx.$pleasure.state }
            ctx.$pleasure.response = (await duckRack.apply(applyPayload)).methodResult
          }
        }
      }
      crudEndpoints.push(await CRUDEndpoint.parse(crudEndpointPayload))
    })
  }

  if (duckRack.duckModel.schema._methods) {
    await registerMethods(duckRack.duckModel.schema._methods)
  }

  const registerChildrenMethods = (model) => {
    return Promise.each(model.ownPaths, async ownPath => {
      const children = model.schemaAtPath(ownPath)
      await registerMethods(children._methods, children.fullPath)
      return registerChildrenMethods(children)
    })
  }
  await registerChildrenMethods(duckRack.duckModel.schema)

  /*
  todo:
    - initialize it using the driver
   */
  return crudEndpoints
}
