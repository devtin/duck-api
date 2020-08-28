/*!
 * duck-api v0.0.3
 * (c) 2020-2020 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
import { Duckfficer, registerDuckRacksFromDir, DuckStorage, registerDuckRacksFromObj, Duck, DuckRack } from 'duck-storage';
import * as duckStorage from 'duck-storage';
export { duckStorage as DuckStorage };
import startCase from 'lodash/startCase.js';
import pick from 'lodash/pick';
import path from 'path';
import { deepScanDir, findPackageJson, packageJson } from '@pleasure-js/utils';
import kebabCase from 'lodash/kebabCase';
import Router from 'koa-router';
import koaBody from 'koa-body';
import koaNTS from 'koa-no-trailing-slash';
import socketIo from 'socket.io';
import flattenDeep from 'lodash/flattenDeep';
import startCase$1 from 'lodash/startCase';
import cleanDeep from 'clean-deep';
import Promise from 'bluebird';
import qs from 'query-string';
import { jsDirIntoJson } from 'js-dir-into-json';
import mapValues from 'lodash/mapValues';
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc';
import omit from 'lodash/omit';
import trim from 'lodash/trim';
import fs from 'fs';
import merge from 'deepmerge';
import { verify, sign } from 'jsonwebtoken';

const statusCodes = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  411: 'Length Required',
  412: 'Precondition Failed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable'
};
class ApiError extends Error {
  constructor (code = 400, message) {
    super(message || statusCodes[code] || 'unknown error');
    this.code = code;
  }
}

const { Schema } = Duckfficer;

const Access = new Schema({
  type: Function,
  required: false
});

function isNotNullObj (obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

const { Schema: Schema$1, Transformers } = Duckfficer;


Transformers.Input = {
  settings: {
    autoCast: true
  },
  cast (v) {
    if (isNotNullObj(v)) {
      return Schema$1.ensureSchema(v)
    }
    return v
  },
  validate (v) {
    if (typeof v !== 'boolean' && !(v instanceof Schema$1)) {
      this.throwError(`Invalid schema or boolean at path ${this.fullPath}`, { value:v, field: this });
    }
  }
};

Transformers.Output = (() => {
  const allKeysAreNumbers = obj => {
    if (isNotNullObj(obj)) {
      return Object.keys(obj).reduce((valid, key) => {
        return valid && /^\d+$/.test(key)
      }, true)
    }
  };

  return {
    settings: {
      autoCast: true
    },
    cast (v) {
      if (!(v instanceof Schema$1) && allKeysAreNumbers(v)) {
        return v
      }

      if (isNotNullObj(v) && !(v instanceof Schema$1) && v.schema) {
        return {
          200: v
        }
      }

      return v ? {
        200: {
          schema: isNotNullObj(v) ? Schema$1.ensureSchema(v) : {}
        }
      } : false
    },
    validate (v) {
      if (v && !allKeysAreNumbers(v)) {
        this.throwError(`Invalid output at path ${this.fullPath}`, { value:v, field: this });
      }
    }
  }
})();

/**
 * @typedef {Object} EndpointHandler
 * @property {Function} handler
 * @property {Access} [access] - Schema for the url get query
 * @property {Schema} [get] - Schema for the url get query
 * @property {Schema} [body] - Schema for the post body object (not available for get endpoints)
 */

const EndpointHandler = new Schema$1({
  access: Access,
  handler: Function,
  example: {
    type: String,
    required: false
  },
  summary: {
    type: String,
    required: false
  },
  description: String,
  errors: {
    type: Object,
    required: false,
    mapSchema: [Schema$1, Object],
  },
  events: {
    type: Object,
    required: false,
    mapSchema: [Schema$1, Object],
  },
  // schemas will be parse with ({ state: { ctx, level } })
  get: {
    type: 'Input',
    default: true
  },
  body: {
    type: 'Input',
    default: true
  },
  output: {
    type: 'Output',
    default: true
  }
}, {
  cast (v) {
    if (typeof v === 'function') {
      return {
        handler: v
      }
    }
    return v
  },
  validate (v) {
    if (v && v.output) {
      Object.keys(v.output).forEach(v => {
        if (!/^[\d]+$/.test(v)) {
          this.throwError(`path output.${v}:  ${v} should be a number`, {field: this.schemaAtPath('output')});
        }
      });
    }
  }
});

const { Schema: Schema$2 } = Duckfficer;

const OptionalEndpoint = {
  type: EndpointHandler,
  required: false
};

/**
 * An object representing all CRUD operations including listing and optional hook for any request.
 * @typedef {Object} CRUD
 * @property {EndpointHandler} [*] - Traps any kind of requests
 * @property {EndpointHandler} [create] - Traps post request
 * @property {EndpointHandler} [read] - Traps get requests to an /:id
 * @property {EndpointHandler} [update] - Traps patch requests
 * @property {EndpointHandler} [delete] - Traps delete requests
 * @property {EndpointHandler} [list] - Traps get requests to an entity with optional filters
 */

const CRUD = new Schema$2({
  '*': OptionalEndpoint,
  all: OptionalEndpoint,
  create: OptionalEndpoint,
  read: OptionalEndpoint,
  update: OptionalEndpoint,
  delete: OptionalEndpoint,
  list: OptionalEndpoint,
}, {
  validate (v) {
    if (v['*'] && v.all) {
      this.throwError(`Provide either '*' or 'all' not both in property ${ this.fullPath }`, { value: v });
    }

    if (!v || Object.keys(v).length === 0) {
      this.throwError(`At least one method (all, create, read, update or delete) is required in property ${ this.fullPath }`, { value: v });
    }
  }
});

const { Schema: Schema$3 } = Duckfficer;

/**
 * A CRUD representation of an endpoint
 * @typedef {Object} CRUDEndpoint
 * @extends CRUD
 * @property {String} path
 */

const CRUDEndpoint = new Schema$3(Object.assign({
  path: String
}, CRUD.schema));

const { Schema: Schema$4 } = Duckfficer;

const Method = new Schema$4({
  access: {
    type: Function,
    required: false
  },
  verb: {
    type: String,
    enum: ['post', 'get', 'patch', 'delete'],
    default: 'post'
  },
  handler: Function,
  description: String,
  input: {
    type: [Schema$4, Object, Boolean],
    default: false
  },
  output: {
    type: [Schema$4, Object, Boolean],
    default: false
  },
  events: {
    type: Object,
    required: false,
    mapSchema: [Schema$4, Object]
  },
  errors: {
    type: Object,
    required: false,
    mapSchema: [Schema$4, Object]
  }
}, {
  cast (v) {
    if (typeof v === 'function') {
      return {
        handler: v
      }
    }
    return v
  }
});

const { Schema: Schema$5 } = Duckfficer;

const CRUDAccess = new Schema$5({
  create: Access,
  read: Access,
  update: Access,
  delete: Access,
  list: Access,
}, {
  cast (access) {
    if (
      access
      && typeof access === 'object'
      && !Array.isArray(access)
      && !access.hasOwnProperty('create')
      && !access.hasOwnProperty('read')
      && !access.hasOwnProperty('update')
      && !access.hasOwnProperty('delete')
      && !access.hasOwnProperty('list')
    ) {
      return {
        create: access,
        read: access,
        update: access,
        delete: access,
        list: access,
      }
    }
    return access
  }
});

const Model = new Schema$5({
    type: Object
}, {
  validate (v) {
    if (!(v instanceof Schema$5)) {
      this.throwError('Invalid model', {field: this, value: v});
    }
  },
  cast (v) {
    if (isNotNullObj(v) && !(v instanceof Schema$5) && Object.keys(v).length > 0 && v.schema) {
      const schema = Schema$5.cloneSchema({ schema: Schema$5.ensureSchema(v.schema) });
      if (v.methods) {
        schema._methods = v.methods;
      }
      return schema
    }
    return v
  }
});

/**
 * @typedef {Object} Entity
 * @property {String} file
 * @property {String} path - URL path of the entity
 * @property {Schema|Object} schema
 * @property {Object} methods
 */
const Entity = new Schema$5({
  file: String,
  path: String,
  name: String,
  duckModel: Model,
  access: CRUDAccess,
  methods: {
    type: Object,
    mapSchema: Method,
    required: false
  }
}, {
  cast (v) {
    if (v && v.file && !v.path) {
      v.path = (`/` + v.file.replace(/\.js$/, '')).replace(/\/_/g, '/:').replace(/\/index$/, '').replace(/^\/+/, '/');
    }
    if (v && v.path && !v.name) {
      v.name = startCase(v.path.split('/').filter(Boolean)[0]).replace(/[\s]+/, '');
    }
    return v
  }
});

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  CRUD: CRUD,
  CRUDEndpoint: CRUDEndpoint,
  EndpointHandler: EndpointHandler,
  Entity: Entity
});

const { Schema: Schema$6 } = Duckfficer;

const changeSchemaDefaultSettings = (newSettings, schema) => {
  Object.assign(schema._settings, newSettings);
  const binder = changeSchemaDefaultSettings.bind(null, newSettings);
  schema.children;
  schema.children.forEach((item) => {
    binder(item);
  });
};

/**
 * Validates incoming traffic against given schemas
 * @param {Schema|Object|Boolean} [get=true] - Get (querystring) schema. true for all; false for  none; schema for validation
 * @param {Schema|Object|Boolean} [body=true] - Post / Delete / Patch (body) schema. true for all; false for  none; schema for validation
 * @throws {Schema~ValidationError} if any validation fails
 * @return Function - Koa middleware
 */

function apiSchemaValidationMiddleware ({ get = true, body = true }) {
  if (get && typeof get === 'object') {
    if (get instanceof Schema$6) {
      get = Schema$6.cloneSchema({ schema: get, settings: {
          autoCast: true
        }
      });
    } else {
      get = new Schema$6(get, {
        settings: {
          autoCast: true
        }
      });
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, get);
  }

  if (body && !(body instanceof Schema$6) && typeof body === 'object') {
    if (body instanceof Schema$6) {
      body = Schema$6.cloneSchema({
        schema: body,
        settings: {
          autoCast: true
        }
      });
    } else {
      body = new Schema$6(body, {
        settings: {
          autoCast: true
        }
      });
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, body);
  }

  return (ctx, next) => {
    const getVars = ctx.$pleasure.get;
    const postVars = ctx.$pleasure.body;

    if (!get && getVars && Object.keys(getVars).length > 0) {
      // todo: throw error
      // todo: log debug
      throw new ApiError()
    }

    if (!body && postVars && Object.keys(postVars).length > 0) {
      // todo: throw error
      // todo: log debug
      // console.log(`avoiding post vars`)
      throw new ApiError()
    }

    const { state } = ctx.$pleasure;
    // console.log({ getVars, postVars })

    try {
      // todo: document that ctx is passed as part of the state
      const parsingOptions = { state: Object.assign({ ctx }, state), virtualsEnumerable: false };
      ctx.$pleasure.get = get && get instanceof Schema$6 ? get.parse(getVars, parsingOptions) : getVars;
      ctx.$pleasure.body = body && body instanceof Schema$6 ? body.parse(postVars, parsingOptions) : postVars;
    } catch (err) {
      console.log('error aqui!!!', err);
      err.code = err.code || 400;
      throw err
    }

    return next()
  }
}

/**
 *
 * @param {Function} access - callback function receives ctx
 * @return {Function}
 */
function responseAccessMiddleware (access) {
  return async (ctx, next) => {
    if (!access) {
      return next()
    }
    // wait for output
    await next();

    if (ctx.body) {
      const pathsToPick = await access(ctx);
      if (typeof pathsToPick === 'boolean' && !pathsToPick) {
        ctx.body = {};
      }
      else if (typeof pathsToPick === 'object') {
        if (Array.isArray(ctx.body)) {
          ctx.body = ctx.body.map(v => pick(v, pathsToPick));
        } else {
          ctx.body = pick(ctx.body, pathsToPick);
        }
      }
    }
  }
}

const crudToMethod = {
  '*': 'all',
  all: 'all',
  create: 'post',
  list: 'get',
  read: 'get',
  update: 'patch',
  delete: 'delete'
};

const methodToCrud = (() => {
  const invertedObject = {};
  Object.keys(crudToMethod).forEach(key => {
    invertedObject[crudToMethod[key]] = key;
  });
  return invertedObject
})();

/**
 * Takes given crudEndpoint as defined
 * @param router
 * @param crudEndpoint
 */
function crudEndpointIntoRouter (router, crudEndpoint) {
  Object.keys(crudEndpoint).filter(k => k !== 'path').forEach(crud => {
    const endpoint = crudEndpoint[crud];
    const { get, body, handler, access = () => true } = endpoint;
    const schemaValidation = apiSchemaValidationMiddleware({ get, body });

    router[crudToMethod[crud]](crudEndpoint.path, responseAccessMiddleware(access), schemaValidation, handler);
  });
}

/**
 * Look for JavaScript files in given directory
 *
 * @param {String} dir - The directory to look for files
 * @return {CRUDEndpoint[]}
 */

async function loadApiCrudDir (dir) {
  require = require('esm')(module);  // eslint-disable-line

  return (await deepScanDir(dir, { only: [/\.js$/] })).map((file) => {
    const fileRelativePath = path.relative(process.cwd(), file);
    const apiRelativePath = path.relative(dir, file);

    const required = Object.assign(require(file).default || require(file), {
      path: (`/` + apiRelativePath.replace(/\.js$/, '')).replace(/\/_/g, '/:').replace(/\/index$/, '')
    });

    try {
      return CRUDEndpoint.parse(required)
    } catch (err) {
      err.file = fileRelativePath;
      throw err
    }
  }).filter(Boolean).sort((a, b) => {
    return a > b ? 1 : -1
  })
}

/**
 * Reads given directory looking for *.js files and parses them into
 * @param dir
 */
async function loadEntitiesFromDir (dir) {
  require = require('esm')(module);  // eslint-disable-line

  const files = await deepScanDir(dir, { only: [/\.js$/] });
  return files.map(file => {
    const entity = require(file).default || require(file);
    entity.file = path.relative(dir, file);

    try {
      return Entity.parse(entity)
    } catch (err) {
      err.file = path.relative(process.cwd(), file);
      err.errors.forEach(console.log);
      throw err
    }
  })
}

const { Schema: Schema$7 } = Duckfficer;

const deeplyChangeSetting = (schema, settings) => {
  Object.assign(schema._settings, settings);
  schema.children.forEach(child => {
    deeplyChangeSetting(child, settings);
  });
};

/**
 * @param entity
 * @param entityDriver
 * @return Promise<[]|*>
 */
function entityToCrudEndpoints (entity, entityDriver) {
  const crudEndpoints = [];

  const updateSchema = Schema$7.cloneSchema({
    schema: entity.duckModel
  });

  deeplyChangeSetting(updateSchema, {
    required: false,
    default: undefined
  });

  // add create, update and list methods
  crudEndpoints.push(CRUDEndpoint.parse({
    path: entity.path,
    create: {
      description: `creates ${entity.name}`,
      access: entity.access.create,
      body: entity.duckModel,
      output: entity.duckModel,
      async handler (ctx) {
        ctx.body = await entityDriver.create(ctx.$pleasure.body);
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
        const doc = await entityDriver.read(ctx.$pleasure.body);
        if (!doc) {
          return next()
        }
        ctx.body = doc;
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
        ctx.body = await entityDriver.update(ctx.$pleasure.get, ctx.$pleasure.body);
      }
    },
    delete: {
      description: `deletes multiple ${entity.name}`,
      access: entity.access.delete,
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.body = await entityDriver.delete(ctx.$pleasure.get);
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
        ctx.body = await entityDriver.list(ctx.$pleasure.get);
      }
    }
  }));

  if (entityDriver.methods) {
    Object.keys(entityDriver.methods).forEach(methodName => {
      const { input, output, handler, description = `method ${methodName}` } = entityDriver.methods[methodName];
      const { access, verb } = entity.methods[methodName];

      crudEndpoints.push(CRUDEndpoint.parse({
        path: `${ entity.path }/${ kebabCase(methodName) }`,
        [methodToCrud[verb]]: {
          access,
          description,
          get: verb === 'get' ? input : undefined,
          body: verb !== 'get' ? input : undefined,
          output,
          async handler (ctx) {
            ctx.body = await handler.call(entityDriver, ctx.$pleasure[verb === 'get' ? 'get' : 'body']);
          }
        }
      }));

    });
  }

  // add read, update and delete methods
  crudEndpoints.push(CRUDEndpoint.parse({
    path: `${ entity.path }/:id`,
    read: {
      // get: pickSchema, // todo: add pick schema
      access: entity.access.read,
      description: `reads one ${entity.name} by id`,
      async handler (ctx, next) {
        const doc = await entityDriver.read(ctx.params.id);
        if (!doc) {
          return next()
        }
        ctx.body = doc;
      },
      output: entity.duckModel
    },
    update: {
      access: entity.access.update,
      description: `updates one ${entity.name} by id`,
      // get: pickSchema
      body: updateSchema,
      async handler (ctx) {
        ctx.body = (await entityDriver.update(ctx.params.id, ctx.$pleasure.body))[0];
      },
      output: entity.duckModel
    },
    delete: {
      access: entity.access.delete,
      description: `deletes one ${entity.name} by id`,
      async handler (ctx) {
        ctx.body = (await entityDriver.delete({ _id: { $eq: ctx.params.id } }))[0];
      },
      output: entity.duckModel
    }
  }));

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
        ctx.body = await entityDriver.list(ctx.$pleasure.body);
      }
    }
  });

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
            const model = await entityDriver.read(ctx.params.id);
            console.log({methodName},model[methodName]);
            ctx.body = await model[methodName](ctx.$pleasure.body);
          }
        }
      };
      crudEndpoints.push(CRUDEndpoint.parse(crudEndpointPayload));
    });
  }

  /*
  todo:
    - initialize it using the driver
   */
  return crudEndpoints
}

function convertToPath (dirPath) {
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_/.test(name) ? ':' : '';
    return propPrefix + kebabCase(name)
  }).join('/')
}

function routeToCrudEndpoints (routeTree = {}, parentPath = []) {
  const endpoints = [];
  if (isNotNullObj(routeTree)) {
    Object.keys(routeTree).forEach(propName => {
      if (propName === '0') {
        throw new Error('reached')
      }
      const value = routeTree[propName];
      const possibleMethod = pick(value, CRUD.ownPaths);

      if (propName === 'someMethod') {
        CRUD.parse(possibleMethod);
      }

      if (CRUD.isValid(possibleMethod)) {
        const path = `/${parentPath.concat(propName).map(convertToPath).join('/')}`;
        endpoints.push(CRUDEndpoint.parse(Object.assign({
          path
        }, possibleMethod)));
        endpoints.push(...routeToCrudEndpoints(omit(value, CRUD.ownPaths), parentPath.concat(propName)));
        return
      }
      endpoints.push(...routeToCrudEndpoints(value, parentPath.concat(propName)));
    });
  }
  return endpoints.filter(Boolean).sort((endpointA, endpointB) => {
    return endpointA.path.indexOf(':') - endpointB.path.indexOf(':')
  })
}

function clientToCrudEndpoints(client) {
  return Object.keys(client.methods).map(methodName => {
    const method = client.methods[methodName];
    methodName = kebabCase(methodName);

    return CRUDEndpoint.parse({
      path: `/${kebabCase(client.name)}/${methodName}`,
      create: {
        description: method.description,
        body: method.input,
        output: method.output,
        async handler (ctx) {
          ctx.body = await method.handler(ctx.$pleasure.body);
        }
      }
    })
  })
}

const { ValidationError } = Duckfficer;


/**
 * @name httpApiSetup.errorHandling
 * @param ctx
 * @param next
 * @return {Promise<void>}
 */
async function errorHandling (ctx, next) {
  try {
    await next();
  } catch (error) {
    const { code = 500, message, errors } = error;
    const resultedError = {
      code,
      error: {
        message
      }
    };
    if (errors) {
      resultedError.error.errors = errors.map(theError => ValidationError.prototype.toJSON.call(theError));
    }
    ctx.body = resultedError;
  }
}

/**
 * @typedef {Function} ApiPlugin
 * @param app - The koa app
 * @param server - The http server
 * @param io - The socket.io instance
 * @param router - Main koa router
 */

/**
 * Resolves given plugin by trying to globally resolve it, otherwise looking in the `plugins.dir` directory or
 * resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.
 *
 * @param {String|Array|Function} pluginName
 * @param {String} [baseDir] - Path to the plugins dir. Defaults to project's local.
 *
 * @return {function}
 */
function loadPlugin (baseDir = process.cwd(), pluginName) {
  if (typeof pluginName === 'function') {
    return pluginName
  }
  const pluginState = {};

  if (Array.isArray(pluginName)) {
    Object.assign(pluginState, pluginName[1]);
    pluginName = pluginName[0];
  }

  try {
    pluginName = require.resolve(pluginName);
    return require(pluginName).bind(pluginState)
  } catch (err) {
    // shh...
  }

  let plugin;

  try {
    plugin = require(path.resolve(baseDir, pluginName));
    plugin = plugin.default || plugin;
  } catch (err) {
    throw new Error(`Error loading plugin ${ pluginName }: ${ err.message }`)
  }

  if (typeof plugin !== 'function') {
    throw new Error(`Invalid plugin ${ pluginName }. A plugin must export a function.`)
  }

  return plugin.bind(pluginState)
}

const { Schema: Schema$8, Utils } = Duckfficer;

const schemaValidatorToSwagger = (schema) => {
  schema = Schema$8.ensureSchema(schema);

  const getType = type => {
    type = type.toLowerCase();
    const allowed = ['string', 'object' , 'number', 'integer', 'array'];
    return allowed.indexOf(type) >= 0 ? type : 'string'
  };

  const remapContent = (obj) => {
    const newObj = {};
    if (!isNotNullObj(obj)) {
      return obj
    }

    if (typeof obj.type === 'string') {
      return {
        type: getType(obj.type),
      }
    }

    Object.keys(obj).forEach(pathName => {
      if (/^\$/.test(pathName)) {
        return
      }
      newObj[pathName] = remapContent(obj[pathName]);
    });

    return newObj
  };

  const output = remapContent(schemaValidatorToJSON(schema));
  return schema.hasChildren ? { type: 'object', properties: output } : output
};

function crudEndpointToOpenApi (crudEndpoint) {
  const tags = [trim(crudEndpoint.path, '/').split('/')[0]];
  const getPathParams = () => {
    const paramsPattern = /\/:[^/]+(?:\/|$)/g;
    const matches = crudEndpoint.path.match(paramsPattern)||[];
    return matches.map((pathName) => {
      pathName = trim(pathName, '/:');
      return {
        name: pathName,
        in: "path",
        description: `${pathName} parameter`,
        required: true,
        style: "simple"
      }
    })
  };

  const getRequestBody = schema => {
    if (typeof schema === 'boolean' || !schema) {
      return
    }
    schema = Schema$8.ensureSchema(schema);
    return {
      description: schema.settings.description,
      content: {
        "application/json": {
          schema: schemaValidatorToSwagger(schema),
          example: schema.settings.example
        }
      }
    }
  };

  const convert = endpoint => {
    if (!endpoint) {
      return
    }

    const { summary, description } = endpoint;
    const getSchema = Schema$8.ensureSchema(endpoint.get);
    const getSchemaJson = schemaValidatorToSwagger(getSchema);

    const requestBody = getRequestBody(endpoint.body);

    const responses = mapValues(endpoint.output, (response) => {
      const { description, summary, example } = response;
      return {
        description,
        summary,
        content: {
          "application/json": {
            schema: schemaValidatorToSwagger(response.schema)
          }
        },
        example
      }
    });

    const parameters = getPathParams().concat(getSchema.paths.map(pathName => {
      if (getSchema.schemaAtPath(pathName).hasChildren) {
        return
      }
      return {
        name: pathName,
        in: "query",
        description: getSchema.schemaAtPath(pathName).settings.description,
        required: getSchema.schemaAtPath(pathName).settings.required,
        example: getSchema.schemaAtPath(pathName).settings.example,
        enum: getSchema.schemaAtPath(pathName).settings.enum,
        schema: Utils.find(getSchemaJson, pathName),
        style: "simple"
      }
    })).filter(Boolean);

    return {
      description,
      summary,
      requestBody,
      parameters,
      tags,
      responses
    }
  };

  const {
    create: post,
    read: get,
    update: patch,
    delete: del,
  } = crudEndpoint;
  return {
    [crudEndpoint.path.replace(/\/:([^/]+)(\/|$)/, '/{$1}$2')]: {
      get: convert(get),
      post: convert(post),
      patch: convert(patch),
      delete: convert(del)
    }
  }
}

function convertToDot (dirPath) {
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_+/.test(name) ? name.match(/^_+/)[0] : '';
    return propPrefix + kebabCase(name)
  }).join('.')
}

const defaultKoaBodySettings = {
  multipart: true,
  parsedMethods: ['GET', 'POST', 'PUT', 'PATCH']
};
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
async function apiSetup ({
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

  const mainRouter = Router();
  const { Schema } = Duckfficer;

  const routesRouter = Router({
    prefix: routesPrefix
  });

  const racksRouter = Router({
    prefix: racksPrefix
  });

  const clientsRouter = Router({
    prefix: clientsPrefix
  });

  /*
    app.use((ctx, next) => {
      console.log(`server re`, ctx.request.url)
      return next()
    })
  */
  app.use(koaNTS());

  // required for the crud logic
  app.use(koaBody(koaBodySettings));
  app.use(customErrorHandling);

  // ctx setup
  app.use((ctx, next) => {
    ctx.leaveAsIs = false;
    ctx.$pleasure = {
      state: {},
      access () {
        return true
      },
      get: {},
      body: {},
      user: null
    };
    return next()
  });

  // todo: abstract in a plugin
  app.use((ctx, next) => {
    ctx.$pleasure.get = ctx.request.querystring ? qs.parse(ctx.request.querystring, { parseNumbers: true }) : {};
    if (ctx.request.body && ctx.request.body.$params) {
      if (Object.keys(ctx.$pleasure.get).length > 0) {
        console.log(`careful! using both params & body on a get request`);
      }
      ctx.$pleasure.get = ctx.request.body.$params;
      delete ctx.request.body.$params;
    }
    ctx.$pleasure.body = ctx.request.body;
    return next()
  });

  const grabClients = async (clientsDir) => {
    const clients = await jsDirIntoJson(clientsDir, { extensions: ['!lib', '!__tests__', '*.js'] });
    return Object.keys(clients).map(name => {
      return {
        name: startCase$1(name).replace(/\s+/g, ''),
        methods: clients[name].methods
      }
    })
  };

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJson(routesDir, {
    path2dot: convertToDot })) : [];

  let racks;
  let racksMethodsAccess;

  if (racksDir && typeof racksDir === 'string') {
    await registerDuckRacksFromDir(racksDir);
    racksMethodsAccess = await jsDirIntoJson( racksDir, { pattern: ['methods/**/access.js'] });
    // todo: create a driver interface
    racks = DuckStorage.listRacks().map(DuckStorage.getRackByName.bind(DuckStorage));
  } else if (typeof racksDir === 'object') {
    racksMethodsAccess = racksDir;
    const racksRegistered = registerDuckRacksFromObj(racksDir);
    racks = Object.keys(racksRegistered).map(rackName => {
      return racksRegistered[rackName]
    });
  }

  const mapMethodAccess = (methods) => {
    if (!methods) {
      return methods
    }
    const mappedMethods = {};
    Object.keys(methods).forEach(methodName => {
      mappedMethods[methodName] = {
        access: methods[methodName].access,
        verb: methods[methodName].verb
      };
    });
    return mappedMethods
  };

  racks = racks.map(rack => {
    const tomerge = [
      {
        file: rack.name,
      },
      pick(rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(racksMethodsAccess[rack.name].methods)
      }
    ];
    // console.log(JSON.stringify(tomerge, null, 2))
    const pl = merge.all(tomerge, {
      isMergeableObject (value) {
        return value && typeof value === 'object' && !(value instanceof Schema) && !(value instanceof Duck) && !(value instanceof DuckRack)
      }
    });
    return Entity.parse(pl)
  });

  const racksEndpoints = flattenDeep(racks.map(entity => {
    return entityToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }));

  const clients = clientsDir ? await grabClients(clientsDir) : [];
  const clientsEndpoints = flattenDeep(clients.map(clientToCrudEndpoints));

  const io = socketIo(server, socketIOSettings);

  // console.log({ entities })
  const registeredEntities = {};

  racks.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase(name)] = cleanDeep(schemaValidatorToJSON(duckModel, { includeAllSettings: false }));
  });

  // console.log({ registeredEntities })
  // return schemas
  racksRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.body = registeredEntities;
  });

  await Promise.each(plugins.map(loadPlugin.bind(null, pluginsDir)), plugin => {
    return plugin({ router: mainRouter, app, server, io })
  });

  // event wiring
  // todo: permissions
  const wireIo = ev => io.emit.bind(io, ev);
  DuckStorage.on('create', wireIo('create'));
  DuckStorage.on('read', wireIo('read'));
  DuckStorage.on('update', wireIo('update'));
  DuckStorage.on('delete', wireIo('delete'));
  DuckStorage.on('list', wireIo('list'));

  app.use(async (ctx, next) => {
    await next();
    // response
    if (!ctx.leaveAsIs && ctx.body !== undefined) {
      ctx.body = {
        code: 200,
        data: ctx.body
      };
    }
  });

  routesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, routesRouter));
  racksEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, racksRouter));
  clientsEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, clientsRouter));

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
  };

  if (process.env.NODE_ENV !== 'production') {
    const swaggerHtml = fs.readFileSync(path.join(findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString();

    const routesSwagger = JSON.stringify(endpointsToSwagger(routesEndpoints, {
      prefix: routesPrefix
    }), null, 2);

    const racksSwagger = JSON.stringify(endpointsToSwagger(racksEndpoints, {
      prefix: racksPrefix
    }), null, 2);

    const clientsSwagger = JSON.stringify(endpointsToSwagger(clientsEndpoints, {
      prefix: clientsPrefix
    }), null, 2);

    routesRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = routesSwagger;
    });
    routesRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = swaggerHtml;
    });

    racksRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = racksSwagger;
    });
    racksRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = swaggerHtml;
    });

    clientsRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = clientsSwagger;
    });
    clientsRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = swaggerHtml;
    });
  }

  app.use(mainRouter.routes());
  app.use(mainRouter.allowedMethods());

  app.use(routesRouter.routes());
  app.use(routesRouter.allowedMethods());

  app.use(racksRouter.routes());
  app.use(racksRouter.allowedMethods());

  app.use(clientsRouter.routes());
  app.use(clientsRouter.allowedMethods());

  // not found
  app.use(() => {
    throw new ApiError(404)
  });

  return { io, mainRouter, routesRouter, racksRouter, routesEndpoints, racksEndpoints, clientsRouter }
}

/**
 * @typedef {Object} Authorization
 * @property {Object} user
 * @property {Number} [expiration]
 * @property {String} [algorithm]
 */

/**
 * @typedef {Function} Authorizer
 * @param {Object} payload - Given payload (matched by given schema body, if any)
 * @return {Authorization|void}
 */

/**
 * @param {String} jwtKey - SSL private key to issue JWT
 * @param {Authorizer} authorizer
 * @param {Object} options
 * @param {String} [options.jwt.headerName=authorization]
 * @param {String} [options.jwt.cookieName=accessToken]
 * @param {Schema|Boolean} [options.jwt.body=true]
 * @param {String} [options.jwt.algorithm=HS256]
 * @param {String} [options.jwt.expiresIn=15 * 60]
 * @emits {Object} created - When a token has been issued
 * @emits {Object} created - When a token has been issued
 * @return {ApiPlugin}
 *
 * @example
 * // pleasure.config.js
 * {
 *   plugins: [
 *     jwtAccess(jwtKey, authorizer, { jwt: { body: true, algorithm: 'HS256', expiryIn: 15 * 60 * 60 } })
 *   ]
 * }
 */
function jwtAccess (jwtKey, authorizer, {
  jwt: {
    cookieName = 'accessToken',
    headerName = 'authorization',
    algorithm = 'HS256',
    expiresIn = 15 * 60, // 15 minutes
    body = true
  },
  authPath = 'auth',
  revokePath = 'revoke'
} = { jwt: {} }) {
  return function ({ router, app, server, io, pls }) {
    /**
     *
     */
    router.use(async (ctx, next) => {
      // two tokens passed (cookie + header) and are distinct => throw
      // token is invalid / expired => throw
      const cookieToken = ctx.cookies.get(cookieName);
      const headerToken = (ctx.request.headers[headerName] || '').replace(/^Bearer /i, '');

      if (cookieToken && headerToken && cookieToken !== headerToken) {
        throw new ApiError(400, `Bad request`)
      }

      const token = headerToken || cookieToken;
      if (token) {
        try {
          ctx.$pleasure.user = verify(token, jwtKey);
        } catch (err) {
          throw new ApiError(401, `Unauthorized`)
        }
      }

      return next()
    });

    /**
     * Creating auth
     * - Validate requested data
     * - Sign returned object into a JWT using provided secret
     * - Generate a next token
     * - Create cookie with JWT
     * - Return JWT
     */
    router.use(authPath, apiSchemaValidationMiddleware({ body }), async (ctx) => {
      // what if an user as already been set?
      const accessToken = sign(await authorizer(ctx.$pleasure.body), jwtKey, {
        algorithm,
        expiresIn
      });

      ctx.cookies.set(cookieName, accessToken);
      ctx.body = { accessToken };
    });

    router.use(revokePath, async ctx => {
      /*
            ctx.body = sign(await authorizer(ctx.$pleasure.body), jwtKey, {
              algorithm,
              expiryIn
            })
      */
    });
  }
}

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  jwtAccess: jwtAccess
});

export { ApiError, index as Schemas, apiSchemaValidationMiddleware, apiSetup, crudEndpointIntoRouter, entityToCrudEndpoints, loadApiCrudDir, loadEntitiesFromDir, index$1 as plugins };
