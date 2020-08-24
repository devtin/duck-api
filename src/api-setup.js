import Router from 'koa-router'
import koaBody from 'koa-body'
import koaNTS from 'koa-no-trailing-slash'
import socketIo from 'socket.io'
import flattenDeep from 'lodash/flattenDeep'
import kebabCase from 'lodash/kebabCase'
import startCase from 'lodash/startCase'
import cleanDeep from 'clean-deep'
import { DuckStorage, registerDuckRacksFromDir, Duckfficer, Duck, DuckRack } from 'duck-storage'
import Promise from 'bluebird'
import qs from 'query-string'
import { jsDirIntoJson } from 'js-dir-into-json'
import pick from 'lodash/pick'
import mapValues from 'lodash/mapValues'
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc'
import { packageJson, findPackageJson } from '@pleasure-js/utils'
import { ApiError } from './lib/api-error.js'
import { crudEndpointIntoRouter } from './lib/crud-endpoint-into-router.js'
import { entityToCrudEndpoints } from './lib/entity-to-crud-endpoints.js'
import { routeToCrudEndpoints } from './lib/route-to-crud-endpoints.js'
import { clientToCrudEndpoints } from './lib/client-to-crud-endpoint.js'
import { Entity } from './lib/schema'
import { errorHandling } from './lib/error-handling.js'
import { loadPlugin } from './lib/load-plugin.js'
import { crudEndpointToOpenApi } from './lib/crud-endpoint-to-openapi.js'
import fs from 'fs'
import path from 'path'
import { convertToDot } from './lib/utils/convert-to-dot'
import { registerDuckRacksFromObj } from 'duck-storage'
import merge from 'deepmerge'

export const defaultKoaBodySettings = {
  multipart: true,
  parsedMethods: ['GET', 'POST', 'PUT', 'PATCH']
}
// todo: replace apiDir (and api concept in general) for gateway
/**
 * Orchestrates all koa middleware's required for the api
 * @param {Object} config
 * @param config.app - The koa app instance
 * @param config.server - The http server returned by app.listen()
 * @param {String} [config.routesDir] - Path to the directory with the js files to load the API from
 * @param {String} [config.racksDir] - Path to the entities directory files to load the duck racks from
 * @param {String} [config.clientsDir] - Path to the clients directory
 * @param {String} [config.routesPrefix=/] - Prefix of the routes router
 * @param {String} [config.racksPrefix=/racks] - Prefix of the racks router
 * @param {String} [config.clientsPrefix=/clients] - Prefix of the entities router
 * @param {String} [config.pluginsDir] - Directory from where to load plugins
 * @param {Object} [options]
 * @param {String[]|Function[]} [options.plugins] - Koa plugins
 * @param {Object} [options.socketIOSettings] - Options for [socket.io]{@link https://socket.io/docs/server-api/}
 * @param {Object} [options.koaBodySettings] - Options for [koa-body]{@link https://github.com/dlau/koa-body}
 * @param {Function} [options.customErrorHandling=errorHandling] - Koa middleware
 * @return {Promise.<{ io, mainRouter, apiRouter, entitiesRouter, apiEndpoints, entitiesEndpoints, pls }>} The koa `app`, the http `server` and the `socket.io` instance, `pls` the system pleasure instance
 * @see {@link https://github.com/koajs/koa} for documentation about the koa `app`
 * @see {@link https://nodejs.org/api/http.html#http_class_http_server} for documentation regarding the http `server`
 */

/*
todo:
- replace pluginsDir for plugins
 */
export async function apiSetup ({
  app,
  server,
  routesDir,
  racksDir,
  clientsDir,
  racksPrefix,
  routesPrefix,
  clientsPrefix,
  pluginsDir
}, { plugins = [], socketIOSettings = {}, koaBodySettings = defaultKoaBodySettings, customErrorHandling = errorHandling } = {}) {
  // const { address, port } = server.address()
  // const apiURL = `http://${ address }:${ port }`

  const mainRouter = Router()
  const { Schema } = Duckfficer

  const routesRouter = Router({
    prefix: routesPrefix
  })

  const racksRouter = Router({
    prefix: racksPrefix
  })

  const clientsRouter = Router({
    prefix: clientsPrefix
  })

  /*
    app.use((ctx, next) => {
      console.log(`server re`, ctx.request.url)
      return next()
    })
  */
  app.use(koaNTS())

  // required for the crud logic
  app.use(koaBody(koaBodySettings))
  app.use(customErrorHandling)

  // ctx setup
  app.use((ctx, next) => {
    ctx.leaveAsIs = false
    ctx.$pleasure = {
      state: {},
      access () {
        return true
      },
      get: {},
      body: {},
      user: null
    }
    return next()
  })

  // todo: abstract in a plugin
  app.use((ctx, next) => {
    ctx.$pleasure.get = ctx.request.querystring ? qs.parse(ctx.request.querystring, { parseNumbers: true }) : {}
    if (ctx.request.body && ctx.request.body.$params) {
      if (Object.keys(ctx.$pleasure.get).length > 0) {
        console.log(`careful! using both params & body on a get request`)
      }
      ctx.$pleasure.get = ctx.request.body.$params
      delete ctx.request.body.$params
    }
    ctx.$pleasure.body = ctx.request.body
    return next()
  })

  const grabClients = async (clientsDir) => {
    const clients = await jsDirIntoJson(clientsDir, { extensions: ['!lib', '!__tests__', '*.js'] })
    return Object.keys(clients).map(name => {
      return {
        name: startCase(name).replace(/\s+/g, ''),
        methods: clients[name].methods
      }
    })
  }

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJson(routesDir, {
    path2dot: convertToDot })) : []

  let racks
  let racksMethodsAccess

  if (racksDir && typeof racksDir === 'string') {
    await registerDuckRacksFromDir(racksDir)
    racksMethodsAccess = await jsDirIntoJson( racksDir, { pattern: ['methods/**/access.js'] })
    // todo: create a driver interface
    racks = DuckStorage.listRacks().map(DuckStorage.getRackByName.bind(DuckStorage))
  } else if (typeof racksDir === 'object') {
    racksMethodsAccess = racksDir
    const racksRegistered = registerDuckRacksFromObj(racksDir)
    racks = Object.keys(racksRegistered).map(rackName => {
      return racksRegistered[rackName]
    })
  }

  const mapMethodAccess = (methods) => {
    if (!methods) {
      return methods
    }
    const mappedMethods = {}
    Object.keys(methods).forEach(methodName => {
      mappedMethods[methodName] = {
        access: methods[methodName].access,
        verb: methods[methodName].verb
      }
    })
    return mappedMethods
  }

  racks = racks.map(rack => {
    const tomerge = [
      {
        file: rack.name,
      },
      pick(rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(racksMethodsAccess[rack.name].methods)
      }
    ]
    // console.log(JSON.stringify(tomerge, null, 2))
    const pl = merge.all(tomerge, {
      isMergeableObject (value) {
        return value && typeof value === 'object' && !(value instanceof Schema) && !(value instanceof Duck) && !(value instanceof DuckRack)
      }
    })
    return Entity.parse(pl)
  })

  const racksEndpoints = flattenDeep(racks.map(entity => {
    return entityToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }))

  const clients = clientsDir ? await grabClients(clientsDir) : []
  const clientsEndpoints = flattenDeep(clients.map(clientToCrudEndpoints))

  const io = socketIo(server, socketIOSettings)

  // console.log({ entities })
  const registeredEntities = {}

  racks.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase(name)] = cleanDeep(schemaValidatorToJSON(duckModel, { includeAllSettings: false }))
  })

  // console.log({ registeredEntities })
  // return schemas
  racksRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.body = registeredEntities
  })

  await Promise.each(plugins.map(loadPlugin.bind(null, pluginsDir)), plugin => {
    return plugin({ router: mainRouter, app, server, io })
  })

  // event wiring
  // todo: permissions
  const wireIo = ev => io.emit.bind(io, ev)
  DuckStorage.on('create', wireIo('create'))
  DuckStorage.on('read', wireIo('read'))
  DuckStorage.on('update', wireIo('update'))
  DuckStorage.on('delete', wireIo('delete'))
  DuckStorage.on('list', wireIo('list'))

  app.use(async (ctx, next) => {
    await next()
    // response
    if (!ctx.leaveAsIs && ctx.body) {
      ctx.body = {
        code: 200,
        data: ctx.body
      }
    }
  })

  routesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, routesRouter))
  racksEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, racksRouter))
  clientsEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, clientsRouter))

  const endpointsToSwagger = (endpoints, {
    prefix = '/',
    title = packageJson().name,
    version = packageJson().version,
    description = packageJson().description,
  } = {}) => {
    return {
      openapi: '3.0.0',
      info: {
        title,
        description,
        version
      },
      paths: endpoints.map(crudEndpointToOpenApi).reduce((output, newRoute) => {
        return Object.assign({}, output, newRoute)
      }, {}),
      servers: [
        {
          url: prefix,
          description: "running server"
        }
      ]
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const swaggerHtml = fs.readFileSync(path.join(findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString()

    const routesSwagger = JSON.stringify(endpointsToSwagger(routesEndpoints, {
      prefix: routesPrefix
    }), null, 2)

    const racksSwagger = JSON.stringify(endpointsToSwagger(racksEndpoints, {
      prefix: racksPrefix
    }), null, 2)

    const clientsSwagger = JSON.stringify(endpointsToSwagger(clientsEndpoints, {
      prefix: clientsPrefix
    }), null, 2)

    routesRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = routesSwagger
    })
    routesRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = swaggerHtml
    })

    racksRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = racksSwagger
    })
    racksRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = swaggerHtml
    })

    clientsRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = clientsSwagger
    })
    clientsRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = swaggerHtml
    })
  }

  app.use(mainRouter.routes())
  app.use(mainRouter.allowedMethods())

  app.use(routesRouter.routes())
  app.use(routesRouter.allowedMethods())

  app.use(racksRouter.routes())
  app.use(racksRouter.allowedMethods())

  app.use(clientsRouter.routes())
  app.use(clientsRouter.allowedMethods())

  // not found
  app.use(() => {
    throw new ApiError(404)
  })

  return { io, mainRouter, routesRouter, racksRouter, routesEndpoints, racksEndpoints, clientsRouter }
}
