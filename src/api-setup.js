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
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc'
import fs from 'fs'
import path from 'path'
import { registerDuckRacksFromObj } from 'duck-storage'
import merge from 'deepmerge'
import { isPlainObject } from 'is-plain-object'
import { packageJson, findPackageJson } from '@pleasure-js/utils'

import { ApiError } from './lib/api-error.js'
import { crudEndpointIntoRouter } from './lib/crud-endpoint-into-router.js'
import { duckRackToCrudEndpoints } from './lib/duck-rack-to-crud-endpoints.js'
import { routeToCrudEndpoints } from './lib/route-to-crud-endpoints.js'
import { gatewayToCrudEndpoints } from './lib/gateway-to-crud-endpoints.js'
import { Entity,CRUDEndpoint } from './lib/schema'
import { errorHandling } from './lib/error-handling.js'
import { loadPlugin } from './lib/load-plugin.js'
import { crudEndpointToOpenApi } from './lib/crud-endpoint-to-openapi.js'
import { convertToDot } from './lib/utils/convert-to-dot'

const { Utils } = Duckfficer
export const defaultKoaBodySettings = {
  multipart: true,
  jsonStrict: false,
  parsedMethods: ['GET', 'POST', 'PUT', 'PATCH']
}
// todo: replace apiDir (and api concept in general) for gateway
/**
 * Orchestrates all koa middleware's required for the api
 * @param {Object} config
 * @param config.app - The koa app instance
 * @param config.server - The http server returned by app.listen()
 * @param {String} [config.routesDir] - Path to the directory with the js files to load the API from
 * @param {String} [config.servicesDir] - Path to the directory with the js files to load the API from
 * @param {String} [config.racksDir] - Path to the entities directory files to load the duck racks from
 * @param {String} [config.gatewaysDir] - Path to the gatewyas directory
 * @param {String} [config.servicesPrefix=/] - Prefix of the services router
 * @param {String} [config.racksPrefix=/racks] - Prefix of the racks router
 * @param {String} [config.gatewaysPrefix=/gateways] - Prefix of the entities router
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
  servicesDir,
  racksDir,
  gatewaysDir,
  racksPrefix,
  servicesPrefix = '/services',
  gatewaysPrefix = '/gateways',
  pluginsPrefix = '/plugins',
  pluginsDir,
}, { plugins = [], socketIOSettings = {}, koaBodySettings = defaultKoaBodySettings, customErrorHandling = errorHandling } = {}) {

  const mainRouter = Router()

  const servicesRouter = Router({
    prefix: servicesPrefix
  })

  const racksRouter = Router({
    prefix: racksPrefix
  })

  const gatewaysRouter = Router({
    prefix: gatewaysPrefix
  })

  const pluginsRouter = Router({
    prefix: pluginsPrefix
  })

  app.use(koaNTS())
  app.use(customErrorHandling)

  // required for the crud logic
  app.use(koaBody(koaBodySettings))

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

  const grabGateways = async (gatewayDir) => {
    const gateways = await jsDirIntoJson(gatewayDir, {
      extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.test.js', '*.js', '*.mjs']
    })
    return Object.keys(gateways).map(name => {
      return {
        name: startCase(name).replace(/\s+/g, ''),
        methods: gateways[name].methods
      }
    })
  }

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJson(routesDir, {
    path2dot: convertToDot,
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.test.js', '*.js', '*.mjs']
  })) : []

  let racks
  let racksMethodsAccess
  let racksCRUDAccess

  if (racksDir && typeof racksDir === 'string') {
    await registerDuckRacksFromDir(racksDir)
    racksMethodsAccess = await jsDirIntoJson( racksDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        'methods/**/access.js'
      ]
    })
    racksCRUDAccess = await jsDirIntoJson( racksDir, {
      extensions: [
        'access.js'
      ]
    })
    // todo: create a driver interface
    racks = DuckStorage.listRacks().map((name) => {
      const duckRack = DuckStorage.getRackByName(name)
      return Object.assign({
        access: Utils.find(racksCRUDAccess, `${name}.access`),
        },
        duckRack)
    })
  } else if (typeof racksDir === 'object') {
    racksMethodsAccess = racksDir
    const racksRegistered = await registerDuckRacksFromObj(racksDir)
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

  racks = await Promise.map(racks, async rack => {
    const tomerge = [
      {
        file: rack.name,
      },
      pick(rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(Utils.find(racksMethodsAccess, `${rack.name}.methods`))
      }
    ]
    const pl = merge.all(tomerge, {
      isMergeableObject: isPlainObject
    })
    return Entity.parse(pl)
  })

  const racksEndpoints = flattenDeep(await Promise.map(racks, entity => {
    return duckRackToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }))

  const gateways = gatewaysDir ? await grabGateways(gatewaysDir) : []
  const gatewaysEndpoints = flattenDeep(await Promise.map(gateways, gatewayToCrudEndpoints))

  const services = gatewaysDir ? await grabGateways(servicesDir) : []
  const servicesEndpoints = flattenDeep(await Promise.map(services, gatewayToCrudEndpoints))

  const io = socketIo(server, socketIOSettings)

  const registeredEntities = {}

  racks.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase(name)] = cleanDeep(schemaValidatorToJSON(duckModel.schema, { includeAllSettings: false }))
  })

  // return schemas
  racksRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.body = registeredEntities
  })

  const pluginsEndpoints = []

  await Promise.each(plugins.map(loadPlugin.bind(null, pluginsDir)), async plugin => {
    const endpoints = plugin({ router: mainRouter, app, server, io })
    if (endpoints) {
      pluginsEndpoints.push(...await Promise.map(endpoints, schema => {
        return CRUDEndpoint.parse(schema)
      }))
    }
  })

  // event wiring
  // todo: permissions
  // todo: move to a plugin
  const wireIo = ev => io.emit.bind(io, ev)
  DuckStorage.on('create', wireIo('create'))
  DuckStorage.on('read', wireIo('read'))
  DuckStorage.on('update', wireIo('update'))
  DuckStorage.on('delete', wireIo('delete'))
  DuckStorage.on('list', wireIo('list'))
  DuckStorage.on('method', wireIo('method'))

  app.use(async (ctx, next) => {
    await next()
    // response
    if (!ctx.leaveAsIs && ctx.body !== undefined) {
      ctx.body = {
        code: 200,
        data: ctx.body
      }
    }
  })

  servicesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, servicesRouter))
  racksEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, racksRouter))
  gatewaysEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, gatewaysRouter))
  pluginsEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, pluginsRouter))
  routesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, mainRouter))

  const endpointsToSwagger = async (endpoints, {
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
      paths: (await Promise.map(endpoints, crudEndpointToOpenApi)).reduce((output, newRoute) => {
        return Object.assign({}, output, newRoute)
      }, {}),
      servers: [
        {
          url: prefix,
          description: "running server"
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          }
        }
      },
      security: [
        {
          "bearerAuth": []
        }
      ]
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const swaggerHtml = fs.readFileSync(path.join(findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString()

    const servicesSwagger = JSON.stringify(await endpointsToSwagger(servicesEndpoints, {
      prefix: servicesPrefix
    }), null, 2)

    const racksSwagger = JSON.stringify(await endpointsToSwagger(racksEndpoints, {
      prefix: racksPrefix
    }), null, 2)

    const gatewaysSwagger = JSON.stringify(await endpointsToSwagger(gatewaysEndpoints, {
      prefix: gatewaysPrefix
    }), null, 2)

    const pluginsSwagger = JSON.stringify(await endpointsToSwagger(pluginsEndpoints, {
      prefix: pluginsPrefix
    }), null, 2)

    servicesRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = servicesSwagger
    })

    servicesRouter.get('/docs', async (ctx) => {
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

    gatewaysRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = gatewaysSwagger
    })

    gatewaysRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = swaggerHtml
    })

    pluginsRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = pluginsSwagger
    })

    pluginsRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = swaggerHtml
    })
  }

  app.use(mainRouter.routes())
  app.use(mainRouter.allowedMethods())

  app.use(servicesRouter.routes())
  app.use(servicesRouter.allowedMethods())

  app.use(racksRouter.routes())
  app.use(racksRouter.allowedMethods())

  app.use(gatewaysRouter.routes())
  app.use(gatewaysRouter.allowedMethods())

  app.use(pluginsRouter.routes())
  app.use(pluginsRouter.allowedMethods())

  // not found
  app.use(() => {
    throw new ApiError(404)
  })

  return { io, mainRouter, servicesRouter, racksRouter, routesEndpoints, servicesEndpoints, racksEndpoints, gatewaysRouter, pluginsRouter }
}
