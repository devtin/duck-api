/*!
 * duck-api v0.0.18
 * (c) 2020-2021 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var duckStorage = require('duck-storage');
var startCase = require('lodash/startCase.js');
var pick = require('lodash/pick');
var path = require('path');
var utils = require('@pleasure-js/utils');
var Promise$1 = require('bluebird');
var kebabCase = require('lodash/kebabCase');
var Router = require('koa-router');
var koaBody = require('koa-body');
var koaNTS = require('koa-no-trailing-slash');
var socketIo = require('socket.io');
var flattenDeep = require('lodash/flattenDeep');
var startCase$1 = require('lodash/startCase');
var castArray = require('lodash/castArray');
var cleanDeep = require('clean-deep');
var qs = require('query-string');
var jsDirIntoJson = require('js-dir-into-json');
var schemaValidatorDoc = require('@devtin/schema-validator-doc');
var fs = require('fs');
var merge = require('deepmerge');
var isPlainObject = require('is-plain-object');
var omit = require('lodash/omit');
var trim = require('lodash/trim');
var mapValues = require('lodash/mapValues');
var jsonwebtoken = require('jsonwebtoken');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () {
            return e[k];
          }
        });
      }
    });
  }
  n['default'] = e;
  return Object.freeze(n);
}

var duckStorage__namespace = /*#__PURE__*/_interopNamespace(duckStorage);
var startCase__default = /*#__PURE__*/_interopDefaultLegacy(startCase);
var pick__default = /*#__PURE__*/_interopDefaultLegacy(pick);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var Promise__default = /*#__PURE__*/_interopDefaultLegacy(Promise$1);
var kebabCase__default = /*#__PURE__*/_interopDefaultLegacy(kebabCase);
var Router__default = /*#__PURE__*/_interopDefaultLegacy(Router);
var koaBody__default = /*#__PURE__*/_interopDefaultLegacy(koaBody);
var koaNTS__default = /*#__PURE__*/_interopDefaultLegacy(koaNTS);
var socketIo__default = /*#__PURE__*/_interopDefaultLegacy(socketIo);
var flattenDeep__default = /*#__PURE__*/_interopDefaultLegacy(flattenDeep);
var startCase__default$1 = /*#__PURE__*/_interopDefaultLegacy(startCase$1);
var castArray__default = /*#__PURE__*/_interopDefaultLegacy(castArray);
var cleanDeep__default = /*#__PURE__*/_interopDefaultLegacy(cleanDeep);
var qs__default = /*#__PURE__*/_interopDefaultLegacy(qs);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var merge__default = /*#__PURE__*/_interopDefaultLegacy(merge);
var omit__default = /*#__PURE__*/_interopDefaultLegacy(omit);
var trim__default = /*#__PURE__*/_interopDefaultLegacy(trim);
var mapValues__default = /*#__PURE__*/_interopDefaultLegacy(mapValues);

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

const { Schema: Schema$8 } = duckStorage.Duckfficer;

const Access = new Schema$8({
  type: Function,
  required: false
});

function isNotNullObj (obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

const { Schema: Schema$7, Transformers } = duckStorage.Duckfficer;


Transformers.Input = {
  settings: {
    autoCast: true
  },
  cast (v) {
    if (isNotNullObj(v) || (typeof v === 'function' &&  Transformers[v.name])) {
      return Schema$7.ensureSchema(typeof v === 'function' ? { type: v } : v)
    }
    return v
  },
  validate (v) {
    if (typeof v !== 'boolean' && !(v instanceof Schema$7)) {
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
      if (!(v instanceof Schema$7) && allKeysAreNumbers(v)) {
        return v
      }

      if (isNotNullObj(v) && !(v instanceof Schema$7) && v.schema) {
        return {
          200: v
        }
      }

      return isNotNullObj(v) ? {
        200: Schema$7.ensureSchema(v)
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

const EndpointHandler = new Schema$7({
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
    mapSchema: [Schema$7, Object],
  },
  events: {
    type: Object,
    required: false,
    mapSchema: [Schema$7, Object],
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

const { Schema: Schema$6 } = duckStorage.Duckfficer;

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

const CRUD = new Schema$6({
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

const { Schema: Schema$5 } = duckStorage.Duckfficer;

/**
 * A CRUD representation of an endpoint
 * @typedef {Object} CRUDEndpoint
 * @extends CRUD
 * @property {String} path
 */

const CRUDEndpoint = new Schema$5(Object.assign({
  path: String
}, CRUD.schema));

const { Schema: Schema$4 } = duckStorage.Duckfficer;

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

const { Schema: Schema$3 } = duckStorage.Duckfficer;

const CRUDAccess = new Schema$3({
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

const Model = new Schema$3({
    type: Object
}, {
  validate (v) {
    if (!(v instanceof duckStorage.Duck)) {
      this.throwError('Invalid model', {field: this, value: v});
    }
  },
  cast (v) {
    if (isNotNullObj(v) && !(v instanceof duckStorage.Duck) && Object.keys(v).length > 0 && v.schema) {
      const schema = Schema$3.ensureSchema(v.schema);
      return new duckStorage.Duck({ schema })
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
const Entity = new Schema$3({
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
      v.name = startCase__default['default'](v.path.split('/').filter(Boolean)[0]).replace(/[\s]+/, '');
    }
    return v
  }
});

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  CRUD: CRUD,
  CRUDEndpoint: CRUDEndpoint,
  EndpointHandler: EndpointHandler,
  Entity: Entity
});

const { Schema: Schema$2 } = duckStorage.Duckfficer;

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
    if (get instanceof Schema$2) {
      get = Schema$2.cloneSchema({ schema: get, settings: {
          autoCast: true
        }
      });
    } else {
      get = new Schema$2(get, {
        settings: {
          autoCast: true
        }
      });
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, get);
  }

  if (body && !(body instanceof Schema$2) && typeof body === 'object') {
    if (body instanceof Schema$2) {
      body = Schema$2.cloneSchema({
        schema: body,
        settings: {
          autoCast: true
        }
      });
    } else {
      body = new Schema$2(body, {
        settings: {
          autoCast: true
        }
      });
    }
    changeSchemaDefaultSettings({
      autoCast: true
    }, body);
  }

  return async (ctx, next) => {
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
      throw new ApiError()
    }

    const { state } = ctx.$pleasure;

    try {
      // todo: document that ctx is passed as part of the state
      const parsingOptions = { state: Object.assign({ ctx }, state), virtualsEnumerable: false };
      ctx.$pleasure.get = get && get instanceof Schema$2 ? await get.parse(getVars, parsingOptions) : getVars;
      ctx.$pleasure.body = body && body instanceof Schema$2 ? await body.parse(postVars, parsingOptions) : postVars;
    } catch (err) {
      err.code = err.code || 400;
      throw err
    }

    return next()
  }
}

/**
 *
 * @param {Function} access - callback function receives ctx
 * @param {object} thisContext - callback function receives ctx
 * @return {Function}
 */
function responseAccessMiddleware (access, thisContext = {}) {
  return async (ctx, next) => {
    if (!access) {
      return next()
    }
    const resolveResultPaths = (pathsToPick, obj) => {
      if (typeof pathsToPick === 'boolean') {
        return  !pathsToPick ? {} : obj
      }
      if (Array.isArray(obj)) {
        return obj.map(v => pick__default['default'](v, pathsToPick))
      }
      return pick__default['default'](obj, pathsToPick)
    };
    const pathsToPick = await access.call(thisContext, ctx);

    // wait for output
    await next();

    if (ctx.body) {
      if (typeof pathsToPick === 'function') {
        ctx.body = resolveResultPaths(await pathsToPick(ctx.body), ctx.body);
      }
      else {
        ctx.body = resolveResultPaths(pathsToPick, ctx.body);
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

    // todo: add error middleware validator for described errors

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

  return (await utils.deepScanDir(dir, { only: [/\.js$/] })).map((file) => {
    const fileRelativePath = path__default['default'].relative(process.cwd(), file);
    const apiRelativePath = path__default['default'].relative(dir, file);

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

  const files = await utils.deepScanDir(dir, { only: [/\.js$/] });
  return Promise__default['default'].map(files, async file => {
    const entity = require(file).default || require(file);
    entity.file = path__default['default'].relative(dir, file);

    try {
      return await Entity.parse(entity)
    } catch (err) {
      err.file = path__default['default'].relative(process.cwd(), file);
      err.errors.forEach(console.log);
      throw err
    }
  })
}

const { Schema: Schema$1, Utils: Utils$2 } = duckStorage.Duckfficer;

const deeplyChangeSetting = (schema, settings) => {
  Object.assign(schema._settings, settings);
  schema.children.forEach(child => {
    deeplyChangeSetting(child, settings);
  });
};

/**
 * @param entity
 * @param {Object} duckRack
 * @return Promise<[]|*>
 */
async function duckRackToCrudEndpoints (entity, duckRack) {
  const crudEndpoints = [];

  const updateSchema = Schema$1.cloneSchema({
    schema: entity.duckModel.originalSchema
  });

  deeplyChangeSetting(updateSchema, {
    required: false,
    default: undefined
  });

  // add create, update and list methods
  crudEndpoints.push(await CRUDEndpoint.parse({
    path: entity.path,
    create: {
      description: `creates ${entity.name}`,
      access: entity.access.create,
      body: entity.duckModel.schema,
      output: entity.duckModel.schema,
      async handler (ctx) {
        ctx.body = await duckRack.create(ctx.$pleasure.body, ctx.$pleasure.state);
      }
    },
    read: {
      access: entity.access.list,
      description: `finds many ${entity.name} by complex query`,
      output: entity.duckModel.schema,
      get: {
        query: {
          type: Object,
          mapSchema: 'Query',
          required: false,
          cast (v) {
            if (typeof v === 'string') {
              try {
                v = JSON.parse(v);
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
        const { state, get: { sort } } = ctx.$pleasure;
        const doc = await duckRack.list(ctx.$pleasure.get.query, {  state, sort });
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
      output: entity.duckModel.schema,
      async handler (ctx) {
        ctx.body = await duckRack.update(ctx.$pleasure.get, ctx.$pleasure.body, ctx.$pleasure.state);
      }
    },
    delete: {
      description: `deletes multiple ${entity.name}`,
      access: entity.access.delete,
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.body = await duckRack.delete(ctx.$pleasure.get, ctx.$pleasure.state);
      }
    }
  }));

  if (duckRack.methods) {
    await Promise__default['default'].each(Object.keys(duckRack.methods), async methodName => {
      const thePath = `${ entity.path }/${ kebabCase__default['default'](methodName) }`;
      const { input, output, handler, description = `method ${methodName}` } = duckRack.methods[methodName];
      const { access, verb = 'post' } = Utils$2.find(duckRack, `_methods.${methodName}`) || {};

      crudEndpoints.push(await CRUDEndpoint.parse({
        path: thePath,
        [methodToCrud[verb]]: {
          access,
          description,
          get: verb === 'get' ? input : undefined,
          body: verb !== 'get' ? input : undefined,
          output,
          async handler (ctx) {
            ctx.body = await handler.call(duckRack, ctx.$pleasure[verb === 'get' ? 'get' : 'body'], { state: ctx.$pleasure.state });
          }
        }
      }));
    });
  }

  // add read, update and delete methods
  crudEndpoints.push(await CRUDEndpoint.parse({
    path: `${ entity.path }/:id`,
    read: {
      // get: pickSchema, // todo: add pick schema
      access: entity.access.read,
      description: `reads one ${entity.name} by id`,
      async handler (ctx, next) {
        const doc = await duckRack.read(ctx.params.id, ctx.$pleasure.state);
        if (!doc) {
          return next()
        }
        ctx.body = doc;
      },
      output: entity.duckModel.schema
    },
    update: {
      access: entity.access.update,
      description: `updates one ${entity.name} by id`,
      // get: pickSchema
      body: updateSchema,
      async handler (ctx) {
        ctx.body = (await duckRack.update(ctx.params.id, ctx.$pleasure.body, ctx.$pleasure.state))[0];
      },
      output: entity.duckModel.schema
    },
    delete: {
      access: entity.access.delete,
      description: `deletes one ${entity.name} by id`,
      async handler (ctx) {
        ctx.body = (await duckRack.delete(ctx.params.id, ctx.$pleasure.state))[0];
      },
      output: entity.duckModel.schema
    }
  }));

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
        ctx.body = await duckRack.list(ctx.$pleasure.get.query, ctx.$pleasure.get.sort)
      }
    }
  }))
*/

  const registerMethods = async (methods = {}, parentPath = '') => {
    return Promise__default['default'].each(Object.keys(methods), async methodName => {
      const method = methods[methodName];
      const dotPath2Path = (dotPath = '') => {
        return dotPath.split(/\./g).map(kebabCase__default['default']).join('/')
      };
      const methodPath = dotPath2Path(parentPath);
      const crudEndpointPayload = {
        path: `${ entity.path }/:id/${methodPath}${ parentPath ? '/' : ''}${ kebabCase__default['default'](methodName) }`,
        [methodToCrud[method.verb || 'post']]: {
          example: method.example,
          description: method.description || `method ${methodName}`,
          get: {
            _v: {
              type: Number,
              required: false
            }
          },
          body: Utils$2.find(method, 'data.router.input') || method.input,
          output: Utils$2.find(method, 'data.router.output') || method.output,
          async handler (ctx) {
            const { id } = ctx.params;
            const { _v } = ctx.$pleasure.get;
            const getPayload = async () => {
              if (Utils$2.find(method, 'data.router.handler')) {
                return method.data.router.handler(ctx.$pleasure.body, ctx)
              }
              return ctx.$pleasure.body
            };
            const getValidate = () => {
              const validator = Utils$2.find(method, 'data.router.validate');
              if (validator) {
                return (doc) => {
                  return validator(doc, ctx)
                }
              }
            };
            const payload = await getPayload();
            const validate = getValidate();
            const applyPayload = { id, _v, path: methodPath, method: methodName, payload, validate, state: ctx.$pleasure.state };
            ctx.body = (await duckRack.apply(applyPayload)).methodResult;
          }
        }
      };
      crudEndpoints.push(await CRUDEndpoint.parse(crudEndpointPayload));
    })
  };

  if (duckRack.duckModel.schema._methods) {
    await registerMethods(duckRack.duckModel.schema._methods);
  }

  const registerChildrenMethods = (model) => {
    return Promise__default['default'].each(model.ownPaths, async ownPath => {
      const children = model.schemaAtPath(ownPath);
      await registerMethods(children._methods, children.fullPath);
      return registerChildrenMethods(children)
    })
  };
  await registerChildrenMethods(duckRack.duckModel.schema);

  /*
  todo:
    - initialize it using the driver
   */
  return crudEndpoints
}

function convertToPath (dirPath) {
  return trim__default['default'](dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_/.test(name) ? ':' : '';
    return propPrefix + kebabCase__default['default'](name)
  }).join('/')
}

async function routeToCrudEndpoints (routeTree = {}, parentPath = []) {
  const endpoints = [];
  if (isNotNullObj(routeTree)) {
    await Promise__default['default'].each(Object.keys(routeTree), async propName => {
      if (propName === '0') {
        throw new Error('reached')
      }
      const value = routeTree[propName];
      const possibleMethod = pick__default['default'](value, CRUD.ownPaths);

      if (await CRUD.isValid(possibleMethod)) {
        const path = `/${parentPath.concat(propName).map(convertToPath).join('/')}`;
        endpoints.push(await CRUDEndpoint.parse(Object.assign({
          path
        }, possibleMethod)));
        endpoints.push(...await routeToCrudEndpoints(omit__default['default'](value, CRUD.ownPaths), parentPath.concat(propName)));
        return
      }
      endpoints.push(...await routeToCrudEndpoints(value, parentPath.concat(propName)));
    });
  }
  return endpoints.filter(Boolean).sort((endpointA, endpointB) => {
    return endpointA.path.indexOf(':') - endpointB.path.indexOf(':')
  })
}

function gatewayToCrudEndpoints(client) {
  return Promise__default['default'].map(Object.keys(client.methods), async methodName => {
    const method = client.methods[methodName];
    methodName = kebabCase__default['default'](methodName);

    return CRUDEndpoint.parse({
      path: `/${kebabCase__default['default'](client.name)}/${methodName}`,
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

const { ValidationError } = duckStorage.Duckfficer;


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
    plugin = require(path__default['default'].resolve(baseDir, pluginName));
    plugin = plugin.default || plugin;
  } catch (err) {
    throw new Error(`Error loading plugin ${ pluginName }: ${ err.message }`)
  }

  if (typeof plugin !== 'function') {
    throw new Error(`Invalid plugin ${ pluginName }. A plugin must export a function.`)
  }

  return plugin.bind(pluginState)
}

const { Schema, Utils: Utils$1 } = duckStorage.Duckfficer;

const schemaValidatorToSwagger = (schema) => {
  schema = Schema.ensureSchema(schema);

  const getType = type => {
    if (typeof type === 'object') {
      if (type.type) {
        return getType(type.type)
      }
      return 'object'
    }
    type = ((typeof type === 'function' ? type.name : type)||'string').toLowerCase();
    const allowed = ['string', 'object' , 'number', 'integer', 'array', 'set'];
    return allowed.indexOf(type) >= 0 ? type : 'string'
  };

  const getOpenApiSettingsFromType = (type, schemaSettings) => {
    const openApiSettings = {};

    if (getType(type) === 'string') {
      if (schemaSettings.settings.enum) {
        Object.assign(openApiSettings, { enum: schemaSettings.settings.enum });
      }
    }

    if (getType(type) === 'array') {
      Object.assign(openApiSettings, {
        items: getType(schemaSettings.settings.arraySchema) || 'string'
      });
    }

    if (getType(type) === 'set') {
      Object.assign(openApiSettings, {
        type: 'array',
        uniqueItems: true
      });
    }

    return openApiSettings
  };

  const remapContent = (obj) => {
    const newObj = {};
    if (!isNotNullObj(obj)) {
      return obj
    }

    if (typeof obj.type === 'string') {
      return {
        type: getType(obj.type),
        ...getOpenApiSettingsFromType(getType(obj), obj)
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

  const output = remapContent(schemaValidatorDoc.schemaValidatorToJSON(schema));
  return schema.hasChildren ? { type: 'object', properties: output } : output
};

function crudEndpointToOpenApi (crudEndpoint) {
  const tags = [trim__default['default'](crudEndpoint.path, '/').split('/')[0]];
  const getPathParams = () => {
    const paramsPattern = /\/:[^/]+(?:\/|$)/g;
    const matches = crudEndpoint.path.match(paramsPattern)||[];
    return matches.map((pathName) => {
      pathName = trim__default['default'](pathName, '/:');
      return {
        name: pathName,
        in: "path",
        description: `${pathName} parameter`,
        required: true,
        style: "simple"
      }
    })
  };

  const getExample = (schema) => {
    if (schema.settings.example) {
      return schema.settings.example
    }

    if (!schema.hasChildren) {
      return ''
    }

    const example = {};

    schema.children.forEach(child => {
      if (!/^_/.test(child.name)) {
        example[child.name] = getExample(child);
      }
    });

    return example
  };

  const getRequestBody = schema => {
    if (typeof schema === 'boolean' || !schema) {
      return
    }
    schema = Schema.ensureSchema(schema);
    return {
      description: schema.settings.description,
      content: {
        "application/json": {
          schema: schemaValidatorToSwagger(schema),
          example: getExample(schema)
        }
      }
    }
  };

  const convert = endpoint => {
    if (!endpoint) {
      return
    }

    const { summary, description } = endpoint;
    const getSchema = Schema.ensureSchema(endpoint.get);
    const getSchemaJson = schemaValidatorToSwagger(getSchema);

    const requestBody = getRequestBody(endpoint.body);

    const responses = mapValues__default['default'](endpoint.output, (response, code) => {
      // const { description, summary, example } = response
      const outputSchema = new Schema({
        code: {
          type: Number,
          example: code
        },
        data: response
      });

      return {
        description: `${code} response`,
        // summary,
        content: {
          "application/json": {
            schema: schemaValidatorToSwagger(outputSchema),
            example: getExample(outputSchema)
          }
        },
        // example
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
        schema: Utils$1.find(getSchemaJson, pathName),
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
  return trim__default['default'](dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_+/.test(name) ? name.match(/^_+/)[0] : '';
    return propPrefix + kebabCase__default['default'](name)
  }).join('.')
}

const { Utils } = duckStorage.Duckfficer;
const defaultKoaBodySettings = {
  multipart: true,
  jsonStrict: false,
  parsedMethods: ['GET', 'POST', 'PUT', 'PATCH']
};
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
async function apiSetup ({
  app,
  server,
  routesDir,
  servicesDir,
  racksDir,
  gatewaysDir,
  racksPrefix = '/domain',
  servicesPrefix = '/services',
  gatewaysPrefix = '/gateways',
  pluginsPrefix = '/plugins',
  duckStorage: duckStorage$1,
  duckStoragePlugins = [],
  pluginsDir,
}, { plugins = [], socketIOSettings = {}, koaBodySettings = defaultKoaBodySettings, customErrorHandling = errorHandling } = {}) {
  const DuckStorage = duckStorage$1 || await new duckStorage.DuckStorageClass({
    plugins: duckStoragePlugins
  });
  const mainRouter = Router__default['default']();

  const servicesRouter = Router__default['default']({
    prefix: servicesPrefix
  });

  const racksRouter = Router__default['default']({
    prefix: racksPrefix
  });

  const gatewaysRouter = Router__default['default']({
    prefix: gatewaysPrefix
  });

  const pluginsRouter = Router__default['default']({
    prefix: pluginsPrefix
  });

  app.use(koaNTS__default['default']());
  app.use(customErrorHandling);

  // required for the crud logic
  app.use(koaBody__default['default'](koaBodySettings));

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
    ctx.$pleasure.get = ctx.request.querystring ? qs__default['default'].parse(ctx.request.querystring, { parseNumbers: true }) : {};
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

  const grabGateways = async (gatewayDir) => {
    const gateways = await jsDirIntoJson.jsDirIntoJson(gatewayDir, {
      extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
    });
    return Object.keys(gateways).map(name => {
      return {
        name: startCase__default$1['default'](name).replace(/\s+/g, ''),
        methods: gateways[name].methods
      }
    })
  };

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJson.jsDirIntoJson(routesDir, {
    path2dot: convertToDot,
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })) : [];

  let racks;
  let racksMethodsAccess;
  let racksCrudAccess;
  let racksCrudDelivery;

  if (racksDir && typeof racksDir === 'string') {
    const remapKeys = (obj) => {
      const mapKeys = (child) => {
        return {
          ...child,
          duckModel: child.model
        }
      };
      const dst = {};

      Object.keys(obj).forEach(propName => {
        dst[propName] = mapKeys(obj[propName]);
      });

      return dst
    };

    await duckStorage.registerDuckRacksFromDir(DuckStorage, racksDir, remapKeys);
    racksMethodsAccess = await jsDirIntoJson.jsDirIntoJson( racksDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        'methods/**/access.js'
      ]
    });
    racksCrudAccess = await jsDirIntoJson.jsDirIntoJson( racksDir, {
      extensions: [
        'access.js'
      ]
    });
    racksCrudDelivery = await jsDirIntoJson.jsDirIntoJson( racksDir, {
      extensions: [
        'delivery.js'
      ]
    });
    // todo: create a driver interface
    racks = DuckStorage.listRacks().map((name) => {
      const duckRack = DuckStorage.getRackByName(name);
      return Object.assign({
        access: Utils.find(racksCrudAccess, `${name}.access`),
        },
        duckRack)
    });
  } else if (typeof racksDir === 'object') {
    racksMethodsAccess = racksDir;
    const racksRegistered = await duckStorage.registerDuckRacksFromObj(racksDir);
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

  racks = await Promise__default['default'].map(racks, async rack => {
    const toMerge = [
      {
        file: rack.name,
      },
      pick__default['default'](rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(Utils.find(racksMethodsAccess, `${rack.name}.methods`))
      }
    ];
    const pl = merge__default['default'].all(toMerge, {
      isMergeableObject: isPlainObject.isPlainObject
    });
    return Entity.parse(pl)
  });

  const racksEndpoints = flattenDeep__default['default'](await Promise__default['default'].map(racks, entity => {
    return duckRackToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }));

  const gateways = gatewaysDir ? await grabGateways(gatewaysDir) : [];
  const gatewaysEndpoints = flattenDeep__default['default'](await Promise__default['default'].map(gateways, gatewayToCrudEndpoints));

  const services = gatewaysDir ? await grabGateways(servicesDir) : [];
  const servicesEndpoints = flattenDeep__default['default'](await Promise__default['default'].map(services, gatewayToCrudEndpoints));

  const io = socketIo__default['default'](server, socketIOSettings);

  const registeredEntities = {};

  racks.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase__default['default'](name)] = cleanDeep__default['default'](schemaValidatorDoc.schemaValidatorToJSON(duckModel.schema, { includeAllSettings: false }));
  });

  // return schemas
  racksRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.body = registeredEntities;
  });

  const pluginsEndpoints = [];

  await Promise__default['default'].each(plugins.map(loadPlugin.bind(null, pluginsDir)), async plugin => {
    const endpoints = plugin({ router: mainRouter, app, server, io });
    if (endpoints) {
      pluginsEndpoints.push(...await Promise__default['default'].map(endpoints, schema => {
        return CRUDEndpoint.parse(schema)
      }));
    }
  });

  // event wiring
  // todo: permissions
  // todo: move to a plugin
  // returns array of rooms
  const getDeliveryDestination = (event, payload) => {
    const delivery = Utils.find(racksCrudDelivery, `${payload.entityName}.delivery`) || true;

    const processOutput = (output) => {
      return typeof output === 'boolean' ? output : castArray__default['default'](delivery)
    };

    if (typeof delivery === 'function') {
      return processOutput(delivery({ event, payload, io }))
    }

    return processOutput(delivery)
  };

  const wireIo = (ev) => {
    return (payload) => {
      const deliveryDestination = getDeliveryDestination(ev, payload);
      if (!deliveryDestination) {
        return
      }

      if (deliveryDestination === true) {
        return io.emit(ev, payload)
      }

      deliveryDestination.forEach(group => {
        io.to(group).emit(ev, payload);
      });
    }
  };

  DuckStorage.on('create', wireIo('create'));
  DuckStorage.on('read', wireIo('read'));
  DuckStorage.on('update', wireIo('update'));
  DuckStorage.on('delete', wireIo('delete'));
  DuckStorage.on('list', wireIo('list'));
  DuckStorage.on('method', wireIo('method'));

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

  servicesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, servicesRouter));
  racksEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, racksRouter));
  gatewaysEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, gatewaysRouter));
  pluginsEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, pluginsRouter));
  routesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, mainRouter));

  const endpointsToSwagger = async (endpoints, {
    prefix = '/',
    title = utils.packageJson().name,
    version = utils.packageJson().version,
    description = utils.packageJson().description,
  } = {}) => {
    return {
      openapi: '3.0.0',
      info: {
        title,
        description,
        version
      },
      paths: (await Promise__default['default'].map(endpoints, crudEndpointToOpenApi)).reduce((output, newRoute) => {
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
  };

  if (process.env.NODE_ENV !== 'production') {
    const swaggerHtml = fs__default['default'].readFileSync(path__default['default'].join(utils.findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString();

    const servicesSwagger = JSON.stringify(await endpointsToSwagger(servicesEndpoints, {
      prefix: servicesPrefix
    }), null, 2);

    const racksSwagger = JSON.stringify(await endpointsToSwagger(racksEndpoints, {
      prefix: racksPrefix
    }), null, 2);

    const gatewaysSwagger = JSON.stringify(await endpointsToSwagger(gatewaysEndpoints, {
      prefix: gatewaysPrefix
    }), null, 2);

    const pluginsSwagger = JSON.stringify(await endpointsToSwagger(pluginsEndpoints, {
      prefix: pluginsPrefix
    }), null, 2);

    servicesRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = servicesSwagger;
    });

    servicesRouter.get('/docs', async (ctx) => {
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

    gatewaysRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = gatewaysSwagger;
    });

    gatewaysRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = swaggerHtml;
    });

    pluginsRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = pluginsSwagger;
    });

    pluginsRouter.get('/docs', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = swaggerHtml;
    });
  }

  app.use(mainRouter.routes());
  app.use(mainRouter.allowedMethods());

  app.use(servicesRouter.routes());
  app.use(servicesRouter.allowedMethods());

  app.use(racksRouter.routes());
  app.use(racksRouter.allowedMethods());

  app.use(gatewaysRouter.routes());
  app.use(gatewaysRouter.allowedMethods());

  app.use(pluginsRouter.routes());
  app.use(pluginsRouter.allowedMethods());

  // not found
  app.use(() => {
    throw new ApiError(404)
  });

  return { io, mainRouter, servicesRouter, racksRouter, routesEndpoints, servicesEndpoints, racksEndpoints, gatewaysRouter, pluginsRouter, DuckStorage }
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
function jwtAccess ({
  cookieName = 'accessToken',
  headerName = 'authorization',
  algorithm = 'HS256',
  expiresIn = 15 * 60, // 15 minutes
  body = true,
  jwtKey,
  auth: {

  },
  authPath = 'auth',
  revokePath = 'revoke',
  authorize,
  serializer // async function that receives a payload and returns the payload that needs to be serialized
} = {}) {
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
          ctx.$pleasure.user = jsonwebtoken.verify(token, jwtKey);
        } catch (err) {
          throw new ApiError(401, `Unauthorized`)
        }
      }

      return next()
    });

    return [
      {
        path: authPath,
        description: 'exchanges credentials for access and refresh tokens',
        async create (ctx) {
          await jsonwebtoken.sign(await authorizer(ctx));
        }
      }
    ]
  }
}

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  jwtAccess: jwtAccess
});

exports.DuckStorage = duckStorage__namespace;
exports.ApiError = ApiError;
exports.Schemas = index$1;
exports.apiSchemaValidationMiddleware = apiSchemaValidationMiddleware;
exports.apiSetup = apiSetup;
exports.crudEndpointIntoRouter = crudEndpointIntoRouter;
exports.duckRackToCrudEndpoints = duckRackToCrudEndpoints;
exports.loadApiCrudDir = loadApiCrudDir;
exports.loadEntitiesFromDir = loadEntitiesFromDir;
exports.plugins = index;
