import kebabCase from 'lodash/kebabCase'
import { Duckfficer } from 'duck-storage'
import { CRUDEndpoint } from './schema'
import { methodToCrud } from './crud-endpoint-into-router'

const { Schema, Utils } = Duckfficer

const deeplyChangeSetting = (schema, settings) => {
  Object.assign(schema._settings, settings)
  schema.children.forEach(child => {
    deeplyChangeSetting(child, settings)
  })
}

/**
 * @param entity
 * @param entityDriver
 * @return Promise<[]|*>
 */
export function entityToCrudEndpoints (entity, entityDriver) {
  const crudEndpoints = []

  const updateSchema = Schema.cloneSchema({
    schema: entity.duckModel
  })

  deeplyChangeSetting(updateSchema, {
    required: false,
    default: undefined
  })

  // add create, update and list methods
  crudEndpoints.push(CRUDEndpoint.parse({
    path: entity.path,
    create: {
      description: `creates ${entity.name}`,
      access: entity.access.create,
      body: entity.duckModel,
      output: entity.duckModel,
      async handler (ctx) {
        ctx.body = await entityDriver.create(ctx.$pleasure.body)
      }
    },
    read: {
      access: entity.access.read,
      description: `finds many ${entity.name} by complex query`,
      output: entity.duckModel,
      // todo: should I also add get: { type: Query } ?
      body: {
        type: 'Query'
      },
      async handler (ctx, next) {
        const doc = await entityDriver.read(ctx.$pleasure.body)
        if (!doc) {
          return next()
        }
        ctx.body = doc
      }
    },
    update: {
      description: `updates multiple ${entity.name}`,
      access: entity.access.update,
      get: {
        type: 'Query'
      },
      body: updateSchema,
      output: entity.duckModel,
      async handler (ctx) {
        ctx.body = await entityDriver.update(ctx.$pleasure.get, ctx.$pleasure.body)
      }
    },
    delete: {
      description: `deletes multiple ${entity.name}`,
      access: entity.access.delete,
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.body = await entityDriver.delete(ctx.$pleasure.get)
      }
    },
    list: {
      description: `lists ${entity.name}`,
      access: entity.access.list,
      output: {
        type: Array,
        arraySchema: entity.duckModel
      },
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.body = await entityDriver.list(ctx.$pleasure.get)
      }
    }
  }))

  if (entityDriver.methods) {
    Object.keys(entityDriver.methods).forEach(methodName => {
      const { input, output, handler, description = `method ${methodName}` } = entityDriver.methods[methodName]
      const { access, verb = 'post' } = Utils.find(entity, `methods.${methodName}`) || {}

      crudEndpoints.push(CRUDEndpoint.parse({
        path: `${ entity.path }/${ kebabCase(methodName) }`,
        [methodToCrud[verb]]: {
          access,
          description,
          get: verb === 'get' ? input : undefined,
          body: verb !== 'get' ? input : undefined,
          output,
          async handler (ctx) {
            ctx.body = await handler.call(entityDriver, ctx.$pleasure[verb === 'get' ? 'get' : 'body'])
          }
        }
      }))

    })
  }

  // add read, update and delete methods
  crudEndpoints.push(CRUDEndpoint.parse({
    path: `${ entity.path }/:id`,
    read: {
      // get: pickSchema, // todo: add pick schema
      access: entity.access.read,
      description: `reads one ${entity.name} by id`,
      async handler (ctx, next) {
        const doc = await entityDriver.read(ctx.params.id)
        if (!doc) {
          return next()
        }
        ctx.body = doc
      },
      output: entity.duckModel
    },
    update: {
      access: entity.access.update,
      description: `updates one ${entity.name} by id`,
      // get: pickSchema
      body: updateSchema,
      async handler (ctx) {
        ctx.body = (await entityDriver.update(ctx.params.id, ctx.$pleasure.body))[0]
      },
      output: entity.duckModel
    },
    delete: {
      access: entity.access.delete,
      description: `deletes one ${entity.name} by id`,
      async handler (ctx) {
        ctx.body = (await entityDriver.delete({ _id: { $eq: ctx.params.id } }))[0]
      },
      output: entity.duckModel
    }
  }))

  // add find endpoint in order to be able to share complex queries
  crudEndpoints.push({
    path: `${ entity.path }/find`,
    create: {
      access: entity.access.read,
      description: `finds many ${entity.name} by complex query`,
      // todo: should I also add get: { type: Query } ?
      body: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.body = await entityDriver.list(ctx.$pleasure.body)
      }
    }
  })

  if (entity.duckModel._methods) {
    Object.keys(entity.duckModel._methods).forEach(methodName => {
      const crudEndpointPayload = {
        path: `${ entity.path }/:id/${ kebabCase(methodName) }`,
        create: {
          example: entity.duckModel._methods[methodName].example,
          description: entity.duckModel._methods[methodName].description || `method ${methodName}`,
          body: entity.duckModel._methods[methodName].input,
          output: entity.duckModel._methods[methodName].output,
          async handler (ctx) {
            // reads the entry first and makes it available in the context
            // todo: document about this behavior
            const model = await entityDriver.read(ctx.params.id)
            console.log({methodName},model[methodName])
            ctx.body = await model[methodName](ctx.$pleasure.body)
          }
        }
      }
      crudEndpoints.push(CRUDEndpoint.parse(crudEndpointPayload))
    })
  }

  /*
  todo:
    - initialize it using the driver
   */
  return crudEndpoints
}
