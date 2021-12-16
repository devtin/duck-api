import Router from 'koa-router'
import asyncBusboy from 'async-busboy'
import koaNTS from 'koa-no-trailing-slash'
import socketIo from 'socket.io'
import flattenDeep from 'lodash/flattenDeep'
import kebabCase from 'lodash/kebabCase'
import castArray from 'lodash/castArray'
import cleanDeep from 'clean-deep'
import { DuckStorageClass, registerDuckRacksFromObj, Duckfficer } from 'duck-storage'
import Promise from 'bluebird'
import qs from 'query-string'
import pick from 'lodash/pick'
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc'
import fs from 'fs'
import path from 'path'
import { isPlainObject } from 'is-plain-object'
import { packageJson, findPackageJson } from '@pleasure-js/utils'
import set from 'lodash/set'
import koaBody from 'koa-body'
import { pleasureDi } from 'pleasure-di'
import merge from 'deepmerge'

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
import { grabClasses } from './lib/grab-classes.js'
import { classesToObj } from './lib/grab-classes-sync.js'
import { jsDirIntoJsonIfExists } from './lib/utils/js-dir-into-json-if-exists.js'

const { Utils, Transformers } = Duckfficer

const contains = (hash, needle) => {
  return new RegExp(`^${needle}`).test(hash)
}

const requestCanBeHandledByBusboy = (ctx) => {
  const ct = ctx.request.headers['content-type']
  return /*contains(ct, 'application/x-www-form-urlencoded') || */contains(ct, 'multipart/form-data');
}

// todo: replace apiDir (and api concept in general) for gateway
/**
 * Orchestrates all koa middleware's required for the api
 * @param {Object} config
 * @param config.app - The koa app instance
 * @param config.server - The http server returned by app.listen()
 * @param {String} [config.routesDir] - Path to the directory with the js files to load the API from
 * @param {String} [config.servicesDir] - Path to the directory with the js files to load the API from
 * @param {String} [config.entitiesDir] - Path to the entities directory files to load the duck domain from
 * @param {String} [config.gatewaysDir] - Path to the gatewyas directory
 * @param {String} [config.servicesPrefix=/] - Prefix of the services router
 * @param {String} [config.domainPrefix=/domain] - Prefix of the domain router
 * @param {String} [config.gatewaysPrefix=/gateways] - Prefix of the entities router
 * @param {String} [config.pluginsDir] - Directory from where to load plugins
 * @param {Boolean} [config.withSwagger] - Defaults to true when NODE_ENV equals development
 * @param {Object} [options]
 * @param {String[]|Function[]} [options.plugins] - Koa plugins
 * @param {Object} [options.socketIOSettings] - Options for [socket.io]{@link https://socket.io/docs/server-api/}
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
  domainDir,
  gatewaysDir,
  domainPrefix = '/domain',
  servicesPrefix = '/services',
  gatewaysPrefix = '/gateways',
  pluginsPrefix = '/plugins',
  duckStorage,
  pluginsDir,
  di,
  customDiResolvers = {},
  withSwagger = process.env.NODE_ENV === 'development',
}, { duckStorageSettings, plugins = [], socketIOSettings = {}, customErrorHandling = errorHandling } = {}) {
  const DuckStorage = duckStorage || await new DuckStorageClass(duckStorageSettings)
  const mainRouter = Router()

  const getDependencyInjector = () => {
    return pleasureDi({
      Rack (rackName) {
        const rack = rackName.replace(/Rack$/, '').toLowerCase()
        return () => DuckStorage.getRackByName(rack)
      },
      Service (serviceName) {
        console.log('requesting', { serviceName })
      },
      Gateway (gatewayName) {
        console.log('requesting', { gatewayName })
      },
      ...customDiResolvers
    })
  }

  di = di || getDependencyInjector()

  const injector = (cb) => {
    return (...args) => {
      return cb()(...args)
    }
  }

  const injectMethods = (obj, di) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (key !== 'methods' && typeof value === 'object' && value !== null) {
        obj[key] = injectMethods(value, di)
      }
    })

    if (obj.methods) {
      Object.values(obj.methods).forEach((method) => {
        const originalHandler = method.handler;
        method.handler = injector(() => originalHandler(di))
      })
    }

    return obj
  }
  const jsDirIntoJsonWithDi = async (path, options) => {
    const obj = await jsDirIntoJsonIfExists(path, options)
    return injectMethods(obj, di)
  }

  const servicesRouter = Router({
    prefix: servicesPrefix
  })

  const domainRouter = Router({
    prefix: domainPrefix
  })

  const gatewaysRouter = Router({
    prefix: gatewaysPrefix
  })

  const pluginsRouter = Router({
    prefix: pluginsPrefix
  })

  app.use(koaNTS())
  app.use(koaBody())
  app.use(customErrorHandling)

  // ctx setup
  app.use((ctx, next) => {
    ctx.leaveAsIs = false
    ctx.$io = io
    ctx.$pleasure = {
      state: {},
      // todo: check if can be removed
      access () {
        return true
      },
      get: {},
      body: {},
      user: null
    }
    return next()
  })

  const io = socketIo(server, socketIOSettings)

  const pluginsEndpoints = []

  // load plugins
  await Promise.each(plugins.map(loadPlugin.bind(null, pluginsDir)), async plugin => {
    const endpoints = await plugin({ router: mainRouter, app, server, io })
    if (endpoints) {
      pluginsEndpoints.push(...await Promise.map(endpoints, schema => {
        return CRUDEndpoint.parse(schema)
      }))
    }
  })

  // todo: abstract in a plugin
  app.use(async (ctx, next) => {
    ctx.$pleasure.get = ctx.request.querystring ? qs.parse(ctx.request.querystring, { parseNumbers: true }) : {}

    const method = ctx.request.method.toLowerCase()
    if (
      method === 'post' ||
      method === 'patch'
    ) {
      if (requestCanBeHandledByBusboy(ctx)) {
        const { fields, files } = await asyncBusboy(ctx.req)

        files.forEach((file) => {
          set(fields, file.fieldname, file)
        })

        ctx.$pleasure.body = fields
        ctx.$pleasure.files = files
      } else {
        ctx.$pleasure.body = ctx.request.body
      }
    }

    return next()
  })

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJsonWithDi(routesDir, {
    path2dot: convertToDot,
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })) : []

  let domain
  let domainMethodsAccess
  let domainCrudAccess
  let domainCrudDelivery

  if (domainDir && typeof domainDir === 'string') {
    const remapKeys = (obj) => {
      const mapKeys = (child) => {
        return {
          ...child,
          duckModel: child.model || child.duckModel
        }
      }
      const dst = {}

      Object.keys(obj).forEach(propName => {
        dst[propName] = mapKeys(obj[propName])
      })

      return dst
    }

    registerDuckRacksFromObj(DuckStorage, remapKeys(await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        '!lib',
        '*.js'
      ],
    })))

    domainMethodsAccess = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        'methods/**/access.js'
      ]
    })
    domainCrudAccess = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        'access.js'
      ]
    })
    domainCrudDelivery = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        'delivery.js'
      ]
    })
    // todo: create a driver interface
    domain = DuckStorage.listRacks().map((name) => {
      const duckRack = DuckStorage.getRackByName(name)
      return Object.assign({
        access: Utils.find(domainCrudAccess, `${name}.access`),
        },
        duckRack)
    })
  } else if (typeof domainDir === 'object') {
    domainMethodsAccess = domainDir
    const domainRegistered = registerDuckRacksFromObj(DuckStorage, domainDir)
    domain = Object.keys(domainRegistered).map(rackName => {
      return domainRegistered[rackName]
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

  console.log(`Promise.map`, { domain })

  domain = await Promise.map(domain, async rack => {
    Transformers[`$${rack.name}`] = rack.duckModel.schema
    const name = rack.name

    const toMerge = [
      {
        name,
        path: `/${name}`
      },
      pick(rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(Utils.find(domainMethodsAccess, `${rack.name}.methods`))
      }
    ]
    const pl = merge.all(toMerge, {
      isMergeableObject: isPlainObject
    })

    return Entity.parse(pl)
  })

  const domainEndpoints = flattenDeep(await Promise.map(domain, entity => {
    return duckRackToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }))

  const gateways = gatewaysDir ? await grabClasses(gatewaysDir) : []

  console.log(`Promise.map`, { gateways })
  const gatewaysEndpoints = flattenDeep(await Promise.map(gateways, gatewayToCrudEndpoints))

  const services = servicesDir ? await grabClasses(servicesDir) : []

  console.log(`Promise.map`, {services})
  const servicesEndpoints = flattenDeep(await Promise.map(services, gatewayToCrudEndpoints))

  const registeredEntities = {}

  domain.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase(name)] = cleanDeep(schemaValidatorToJSON(duckModel.schema, { includeAllSettings: false }))
  })

  // return schemas
  domainRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.$pleasure.response = registeredEntities
  })

  // event wiring
  // todo: permissions
  // todo: move to a plugin
  // returns array of rooms
  const getDeliveryDestination = (event, payload) => {
    const delivery = Utils.find(domainCrudDelivery, `${payload.entityName}.delivery`) || true

    const processOutput = (output) => {
      return typeof output === 'boolean' ? output : castArray(delivery)
    }

    if (typeof delivery === 'function') {
      return processOutput(delivery({ event, payload, io }))
    }

    return processOutput(delivery)
  }

  const wireIo = (ev) => {
    return (payload) => {
      const deliveryDestination = getDeliveryDestination(ev, payload)
      if (!deliveryDestination) {
        return
      }

      if (deliveryDestination === true) {
        return io.emit(ev, payload)
      }

      deliveryDestination.forEach(group => {
        io.to(group).emit(ev, payload)
      })
    }
  }

  DuckStorage.on('create', wireIo('create'))
  DuckStorage.on('read', wireIo('read'))
  DuckStorage.on('update', wireIo('update'))
  DuckStorage.on('delete', wireIo('delete'))
  DuckStorage.on('list', wireIo('list'))
  DuckStorage.on('method', wireIo('method'))

  app.use(async (ctx, next) => {
    await next()
    // response
    const responseType = ctx.response.type;
    if (ctx.body === undefined) {
      if (ctx.leaveAsIs) {
        ctx.body = ctx.$pleasure.response
      }
      else {
        const data = ctx.$pleasure.response || {}
        ctx.body = {
          code: 200,
          data,
        }
      }

      if (responseType) {
        ctx.set('Content-Type', responseType)
      }
    }
  })

  servicesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, servicesRouter))
  domainEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, domainRouter))
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

  if (withSwagger) {
    const swaggerHtml = fs.readFileSync(path.join(findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString()

    const servicesSwagger = JSON.stringify(await endpointsToSwagger(servicesEndpoints, {
      prefix: servicesPrefix
    }), null, 2)

    const domainSwagger = JSON.stringify(await endpointsToSwagger(domainEndpoints, {
      prefix: domainPrefix
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

    domainRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true
      ctx.body = domainSwagger
    })
    domainRouter.get('/docs', async (ctx) => {
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

  app.use(domainRouter.routes())
  app.use(domainRouter.allowedMethods())

  app.use(gatewaysRouter.routes())
  app.use(gatewaysRouter.allowedMethods())

  app.use(pluginsRouter.routes())
  app.use(pluginsRouter.allowedMethods())

  // not found
  app.use(() => {
    throw new ApiError(404)
  })

  return { io, mainRouter, servicesRouter, domainRouter, routesEndpoints, servicesEndpoints, domainEndpoints, gatewaysRouter, pluginsRouter, DuckStorage, gateways: classesToObj(gateways), services: classesToObj(services), di }
}
