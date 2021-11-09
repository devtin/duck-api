/*!
 * duck-api v0.0.31
 * (c) 2020-2021 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
import { Duckfficer, Duck, DuckStorageClass, registerDuckRacksFromObj } from 'duck-storage';
import * as duckStorage from 'duck-storage';
export { duckStorage as DuckStorage };
import pick from 'lodash/pick';
import path from 'path';
import { deepScanDir, findPackageJson, packageJson } from '@pleasure-js/utils';
import { jsDirIntoJson, jsDirIntoJsonSync } from 'js-dir-into-json';
import Promise$1 from 'bluebird';
import kebabCase from 'lodash/kebabCase';
import startCase from 'lodash/startCase';
import { duckfficerMethod } from 'duckfficer-method';
import Router from 'koa-router';
import asyncBusboy from 'async-busboy';
import koaNTS from 'koa-no-trailing-slash';
import socketIo from 'socket.io';
import flattenDeep from 'lodash/flattenDeep';
import castArray from 'lodash/castArray';
import cleanDeep from 'clean-deep';
import qs from 'query-string';
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc';
import fs from 'fs';
import { isPlainObject } from 'is-plain-object';
import set from 'lodash/set';
import koaBody from 'koa-body';
import { pleasureDi } from 'pleasure-di';
import merge from 'deepmerge';
import omit from 'lodash/omit';
import trim from 'lodash/trim';
import mapValues from 'lodash/mapValues';
import forEach from 'lodash/forEach';
import { sign, verify } from 'jsonwebtoken';
import cookie from 'cookie';

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

const { Schema: Schema$8 } = Duckfficer;

const Access = new Schema$8({
  type: Function,
  required: false
});

function isNotNullObj (obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

const { Schema: Schema$7, Transformers: Transformers$2 } = Duckfficer;


Transformers$2.Input = {
  settings: {
    autoCast: true
  },
  cast (v) {
    if (isNotNullObj(v) || (typeof v === 'function' &&  Transformers$2[v.name])) {
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

Transformers$2.Output = (() => {
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

const { Schema: Schema$6 } = Duckfficer;

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

const { Schema: Schema$5 } = Duckfficer;

/**
 * A CRUD representation of an endpoint
 * @typedef {Object} CRUDEndpoint
 * @extends CRUD
 * @property {String} path
 */

const CRUDEndpoint = new Schema$5(Object.assign({
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

const { Schema: Schema$3 } = Duckfficer;

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
    if (!(v instanceof Duck)) {
      this.throwError('Invalid model', {field: this, value: v});
    }
  },
  cast (v) {
    if (isNotNullObj(v) && !(v instanceof Duck) && Object.keys(v).length > 0 && v.schema) {
      const schema = Schema$3.ensureSchema(v.schema);
      return new Duck({ schema })
    }
    return v
  }
});

/**
 * @typedef {Object} Entity
 * @property {String} path - URL path of the entity
 * @property {Schema|Object} schema
 * @property {Object} methods
 */
const Entity = new Schema$3({
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
    if (v.model && !v.duckModel) {
      v.duckModel = v.model;
    }
    return v
  },
  stripUnknown: true
});

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  CRUD: CRUD,
  CRUDEndpoint: CRUDEndpoint,
  EndpointHandler: EndpointHandler,
  Entity: Entity
});

const { Schema: Schema$2 } = Duckfficer;

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
        return obj.map(v => pick(v, pathsToPick))
      }
      return pick(obj, pathsToPick)
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

const methodToCrud$1 = (() => {
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

const prettyPrintError = (error) => {
  console.log(`  ${error.constructor.name}:`, error.message);
  console.log(`  - value:`, error.value);
  console.log(`  - field:`, error.field.fullPath);
  console.log('');
};

/**
 * Reads given directory looking for *.js files and parses them into
 * @param dir
 */

async function loadEntitiesFromDir (dir) {
  require = require('esm')(module);  // eslint-disable-line

  const entities = await jsDirIntoJson(dir);

  return Promise$1.map(Object.entries(entities), async ([entityName, entity]) => {
    entity.name = entityName;
    entity.path = `/${entityName}`;

    try {
      return await Entity.parse(entity)
    } catch (err) {
      err.name = entityName;
      err.errors.forEach(prettyPrintError);
      throw err
    }
  })
}

const { Schema: Schema$1, Utils: Utils$2 } = Duckfficer;

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
        ctx.$pleasure.response = await duckRack.create(ctx.$pleasure.body, ctx.$pleasure.state);
      }
    },
    read: {
      access: entity.access.list,
      description: `finds many ${entity.name} by complex query`,
      output: new Schema$1({ type: Array, arraySchema: entity.duckModel.schema }),
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
        ctx.$pleasure.response = doc;
      }
    },
    update: {
      description: `updates multiple ${entity.name}`,
      access: entity.access.update,
      get: {
        type: 'Query'
      },
      body: updateSchema,
      output: new Schema$1({ type: Array, arraySchema: entity.duckModel.schema }),
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.update(ctx.$pleasure.get, ctx.$pleasure.body, ctx.$pleasure.state);
      }
    },
    delete: {
      description: `deletes multiple ${entity.name}`,
      access: entity.access.delete,
      get: {
        type: 'Query'
      },
      async handler (ctx) {
        ctx.$pleasure.response = await duckRack.delete(ctx.$pleasure.get, ctx.$pleasure.state);
      }
    }
  }));

  if (duckRack.methods) {
    await Promise$1.each(Object.keys(duckRack.methods), async methodName => {
      const thePath = `${ entity.path }/${ kebabCase(methodName) }`;
      const { input, output, handler, description = `method ${methodName}` } = duckRack.methods[methodName];
      const { access, verb = 'post' } = Utils$2.find(duckRack, `_methods.${methodName}`) || {};

      crudEndpoints.push(await CRUDEndpoint.parse({
        path: thePath,
        [methodToCrud$1[verb]]: {
          access,
          description,
          get: verb === 'get' ? input : undefined,
          body: verb !== 'get' ? input : undefined,
          output,
          async handler (ctx) {
            ctx.$pleasure.response = await handler.call(duckRack, ctx.$pleasure[verb === 'get' ? 'get' : 'body'], { state: ctx.$pleasure.state });
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
        ctx.$pleasure.response = doc;
      },
      output: entity.duckModel.schema
    },
    update: {
      access: entity.access.update,
      description: `updates one ${entity.name} by id`,
      // get: pickSchema
      body: updateSchema,
      async handler (ctx) {
        ctx.$pleasure.response = (await duckRack.update(ctx.params.id, ctx.$pleasure.body, ctx.$pleasure.state))[0];
      },
      output: entity.duckModel.schema
    },
    delete: {
      access: entity.access.delete,
      description: `deletes one ${entity.name} by id`,
      async handler (ctx) {
        ctx.$pleasure.response = (await duckRack.delete(ctx.params.id, ctx.$pleasure.state))[0];
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
        ctx.$pleasure.response = await duckRack.list(ctx.$pleasure.get.query, ctx.$pleasure.get.sort)
      }
    }
  }))
*/

  const registerMethods = async (methods = {}, parentPath = '') => {
    return Promise$1.each(Object.keys(methods), async methodName => {
      const method = methods[methodName];
      const dotPath2Path = (dotPath = '') => {
        return dotPath.split(/\./g).map(kebabCase).join('/')
      };
      const methodPath = dotPath2Path(parentPath);
      const crudEndpointPayload = {
        path: `${ entity.path }/:id/${methodPath}${ parentPath ? '/' : ''}${ kebabCase(methodName) }`,
        [methodToCrud$1[method.verb || 'post']]: {
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
            ctx.$pleasure.response = (await duckRack.apply(applyPayload)).methodResult;
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
    return Promise$1.each(model.ownPaths, async ownPath => {
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

const jsDirIntoJsonIfExists = async (...args) => {
  try {
    return await jsDirIntoJson(...args)
  }
  catch (err) {
    return []
  }
};

const jsDirIntoJsonIfExistsSync = (...args) => {
  try {
    return jsDirIntoJsonSync(...args)
  }
  catch (err) {
    return []
  }
};

const methodsToDuckfficer = (methods) => {
  const methodsObj = {};

  Object.keys(methods).forEach((methodName) => {
    const method = duckfficerMethod(methods[methodName]);
    methodsObj[methodName] = async (...payload) => {
      try {
        const { output } = await method(...payload);
        return output
      } catch (error) {
        throw error.originalError
      }
    };
  });

  return methodsObj
};

const classesToObj = (classesArray) => {
  return classesArray.reduce((objClass, currentClass) => {
    return Object.assign(objClass, {
      [currentClass.name]: methodsToDuckfficer(currentClass.methods)
    })
  }, {})
};

const grabClassesSync = (classesPath) => {
  const gateways = jsDirIntoJsonIfExistsSync(classesPath, {
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  });
  return Object.keys(gateways).map(name => {
    return {
      name: startCase(name).replace(/\s+/g, ''),
      methods: gateways[name].methods
    }
  })
};

const grabClasses = async (classesPath) => {
  const gateways = await jsDirIntoJsonIfExists(classesPath, {
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  });
  return Object.keys(gateways).map(name => {
    return {
      name: startCase(name).replace(/\s+/g, ''),
      methods: gateways[name].methods
    }
  })
};

function convertToPath (dirPath) {
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_/.test(name) ? ':' : '';
    return propPrefix + kebabCase(name)
  }).join('/')
}

async function routeToCrudEndpoints (routeTree = {}, parentPath = []) {
  const endpoints = [];
  if (isNotNullObj(routeTree)) {
    await Promise$1.each(Object.keys(routeTree), async propName => {
      if (propName === '0') {
        throw new Error('reached')
      }
      const value = routeTree[propName];
      const possibleMethod = pick(value, CRUD.ownPaths);

      if (await CRUD.isValid(possibleMethod)) {
        const path = `/${parentPath.concat(propName).map(convertToPath).join('/')}`;
        endpoints.push(await CRUDEndpoint.parse(Object.assign({
          path
        }, possibleMethod)));
        endpoints.push(...await routeToCrudEndpoints(omit(value, CRUD.ownPaths), parentPath.concat(propName)));
        return
      }
      endpoints.push(...await routeToCrudEndpoints(value, parentPath.concat(propName)));
    });
  }
  return endpoints.filter(Boolean).sort((endpointA, endpointB) => {
    return endpointA.path.indexOf(':') - endpointB.path.indexOf(':')
  })
}

const methodToCrud = {
  post: 'create',
  get: 'read',
  patch: 'update',
  delete: 'delete'
};

function gatewayToCrudEndpoints(client) {
  return Promise$1.map(Object.keys(client.methods), async methodName => {
    const method = client.methods[methodName];
    methodName = kebabCase(methodName);

    return CRUDEndpoint.parse({
      path: `/${kebabCase(client.name)}/${methodName}`,
      [methodToCrud[method.verb || 'post']]: {
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
    console.log(error);
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

const { Schema, Utils: Utils$1, Transformers: Transformers$1 } = Duckfficer;

const getSchema = (schema) => {
  if (schema.type && /^\$/.test(schema.type) && Transformers$1[schema.type]) {
    return Schema.ensureSchema(Transformers$1[schema.type])
  }
  return Schema.ensureSchema(schema);
};

const getExample = (schema) => {
  schema = getSchema(schema);

  if (schema.settings.example) {
    return schema.settings.example
  }

  if (getType(schema) === 'array' && schema.settings.arraySchema) {
    return [getExample(getSchema(schema.settings.arraySchema))]
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

const getType = (type) => {
  if (typeof type === 'object' && !Array.isArray(type)) {
    if (type.type) {
      return getType(type.type)
    }
    return 'object'
  }

  if (/^\$/.test(type)) {
    return 'object'
  }

  const foundType = ((typeof type === 'function' ? type.name : type)||'string').toString().toLowerCase();

  const allowed = ['string', 'object' , 'number', 'integer', 'array', 'file', 'date'];
  return allowed.indexOf(foundType) >= 0 ? foundType : 'string'
};

const processObject = ({ schema, requestType }) => {
  const properties = {};
  schema.children.forEach((children) => {
    // console.log(`children`, children)

    Object.assign(properties, {
      [children.name]: schemaValidatorToSwagger(children, requestType)
    });
  });
  // console.log(JSON.stringify({ properties }, null,2))
  return {
    properties
  }
};

const schemaTypeToSwagger = {
  array({ requestType, schema }){
    // console.log('array!', { requestType, schema })
    return {
      items: schemaValidatorToSwagger(schema.settings.arraySchema, requestType) || 'string',
      example: [getExample(schema)]
    }
  },
  date () {
    return {
      type: 'string',
      format: 'date-time'
    }
  },
  file({ requestType }) {
    if (requestType === 'request') {
      return {
        type: 'string',
        format: 'binary'
      }
    }

    return {
      type: 'string'
    }
  },
  set () {
    return {
      type: 'array',
      uniqueItems: true
    }
  },
  string({ schema }) {
    if (schema.settings.enum && schema.settings.enum.length > 0) {
      return { enum: schema.settings.enum }
    }
  },
  object: processObject
};

const schemaValidatorToSwagger = (schema, requestType) => {
  schema = getSchema(schema);

  // todo: move this somewhere it can be override
  const getOpenApiSettingsForSchema = (schema) => {
    const openApiSettings = {};
    const type = getType(schema);
    const typeFn = schemaTypeToSwagger[type];

    if (typeFn) {
      Object.assign(openApiSettings, typeFn({ requestType, schema })||{});
    }

    return openApiSettings
  };

  const remapContent = (schema) => {
    const obj = schemaValidatorToJSON(schema);
    if (!isNotNullObj(obj)) {
      return obj
    }

    return {
      type: getType(schema),
      ...getOpenApiSettingsForSchema(schema)
    }
  };

  return remapContent(schema)
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

  const schemaHasFileUpload = (schema) => {
    if (schema.hasChildren) {
      let hasFile = false;
      forEach(schema.children, (child) => {
        hasFile = schemaHasFileUpload(child);
        return !hasFile
      });
      return hasFile
    }

    return schema.type === 'File'
  };

  const getRequestBody = (schema) => {
    if (typeof schema === 'boolean' || !schema) {
      return
    }
    schema = Schema.ensureSchema(schema);
    return {
      description: schema.settings.description,
      content: {
        [schemaHasFileUpload(schema) ? "multipart/form-data" : "application/json"]: {
          schema: schemaValidatorToSwagger(schema, 'request'),
          example: getExample(schema)
        }
      }
    }
  };

  const convert = (endpoint) => {
    if (!endpoint) {
      return
    }

    const { summary, description } = endpoint;
    const GETSchema = getSchema(endpoint.get);
    const getSchemaJson = schemaValidatorToSwagger(GETSchema, 'request');

    const requestBody = getRequestBody(endpoint.body);

    const responses = mapValues(endpoint.output, (response, code) => {
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
            schema: schemaValidatorToSwagger(outputSchema, 'response'),
            example: getExample(outputSchema)
          }
        },
        // example
      }
    });

    const parameters = getPathParams().concat(GETSchema.paths.map(pathName => {
      if (GETSchema.schemaAtPath(pathName).hasChildren) {
        return
      }
      return {
        name: pathName,
        in: "query",
        description: GETSchema.schemaAtPath(pathName).settings.description,
        required: GETSchema.schemaAtPath(pathName).settings.required,
        example: GETSchema.schemaAtPath(pathName).settings.example,
        enum: GETSchema.schemaAtPath(pathName).settings.enum,
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
  return trim(dirPath, '/').replace(/((^|\/)index)?\.js(on)?$/i, '').split('/').map((name) => {
    const propPrefix = /^_+/.test(name) ? name.match(/^_+/)[0] : '';
    return propPrefix + kebabCase(name)
  }).join('.')
}

const { Utils, Transformers } = Duckfficer;

const contains = (hash, needle) => {
  return new RegExp(`^${needle}`).test(hash)
};

const requestCanBeHandledByBusboy = (ctx) => {
  const ct = ctx.request.headers['content-type'];
  return /*contains(ct, 'application/x-www-form-urlencoded') || */contains(ct, 'multipart/form-data');
};

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
async function apiSetup ({
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
  const DuckStorage = duckStorage || await new DuckStorageClass(duckStorageSettings);
  const mainRouter = Router();

  const getDependencyInjector = () => {
    return pleasureDi({
      Rack (rackName) {
        const rack = rackName.replace(/Rack$/, '').toLowerCase();
        return () => DuckStorage.getRackByName(rack)
      },
      Service (serviceName) {
        console.log('requesting', { serviceName });
      },
      Gateway (gatewayName) {
        console.log('requesting', { gatewayName });
      },
      ...customDiResolvers
    })
  };

  di = di || getDependencyInjector();

  const injector = (cb) => {
    return (...args) => {
      return cb()(...args)
    }
  };

  const injectMethods = (obj, di) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (key !== 'methods' && typeof value === 'object') {
        obj[key] = injectMethods(value, di);
      }
    });

    if (obj.methods) {
      Object.values(obj.methods).forEach((method) => {
        const originalHandler = method.handler;
        method.handler = injector(() => originalHandler(di));
      });
    }

    return obj
  };
  const jsDirIntoJsonWithDi = async (path, options) => {
    const obj = await jsDirIntoJsonIfExists(path, options);
    return injectMethods(obj, di)
  };

  const servicesRouter = Router({
    prefix: servicesPrefix
  });

  const domainRouter = Router({
    prefix: domainPrefix
  });

  const gatewaysRouter = Router({
    prefix: gatewaysPrefix
  });

  const pluginsRouter = Router({
    prefix: pluginsPrefix
  });

  app.use(koaNTS());
  app.use(koaBody());
  app.use(customErrorHandling);

  // ctx setup
  app.use((ctx, next) => {
    ctx.leaveAsIs = false;
    ctx.$io = io;
    ctx.$pleasure = {
      state: {},
      // todo: check if can be removed
      access () {
        return true
      },
      get: {},
      body: {},
      user: null
    };
    return next()
  });

  const io = socketIo(server, socketIOSettings);

  const pluginsEndpoints = [];

  // load plugins
  await Promise$1.each(plugins.map(loadPlugin.bind(null, pluginsDir)), async plugin => {
    const endpoints = await plugin({ router: mainRouter, app, server, io });
    if (endpoints) {
      pluginsEndpoints.push(...await Promise$1.map(endpoints, schema => {
        return CRUDEndpoint.parse(schema)
      }));
    }
  });

  // todo: abstract in a plugin
  app.use(async (ctx, next) => {
    ctx.$pleasure.get = ctx.request.querystring ? qs.parse(ctx.request.querystring, { parseNumbers: true }) : {};

    const method = ctx.request.method.toLowerCase();
    if (
      method === 'post' ||
      method === 'patch'
    ) {
      if (requestCanBeHandledByBusboy(ctx)) {
        const { fields, files } = await asyncBusboy(ctx.req);

        files.forEach((file) => {
          set(fields, file.fieldname, file);
        });

        ctx.$pleasure.body = fields;
        ctx.$pleasure.files = files;
      } else {
        ctx.$pleasure.body = ctx.request.body;
      }
    }

    return next()
  });

  const routesEndpoints = routesDir ? await routeToCrudEndpoints(await jsDirIntoJsonWithDi(routesDir, {
    path2dot: convertToDot,
    extensions: ['!lib', '!__tests__', '!*.unit.js', '!*.spec.js', '!*.test.js', '*.js', '*.mjs']
  })) : [];

  let domain;
  let domainMethodsAccess;
  let domainCrudAccess;
  let domainCrudDelivery;

  if (domainDir && typeof domainDir === 'string') {
    const remapKeys = (obj) => {
      const mapKeys = (child) => {
        return {
          ...child,
          duckModel: child.model || child.duckModel
        }
      };
      const dst = {};

      Object.keys(obj).forEach(propName => {
        dst[propName] = mapKeys(obj[propName]);
      });

      return dst
    };

    registerDuckRacksFromObj(DuckStorage, remapKeys(await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        '!lib',
        '*.js'
      ],
    })));

    domainMethodsAccess = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        '!__tests__',
        '!*.unit.js',
        'methods/**/access.js'
      ]
    });
    domainCrudAccess = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        'access.js'
      ]
    });
    domainCrudDelivery = await jsDirIntoJsonWithDi(domainDir, {
      extensions: [
        'delivery.js'
      ]
    });
    // todo: create a driver interface
    domain = DuckStorage.listRacks().map((name) => {
      const duckRack = DuckStorage.getRackByName(name);
      return Object.assign({
        access: Utils.find(domainCrudAccess, `${name}.access`),
        },
        duckRack)
    });
  } else if (typeof domainDir === 'object') {
    domainMethodsAccess = domainDir;
    const domainRegistered = registerDuckRacksFromObj(DuckStorage, domainDir);
    domain = Object.keys(domainRegistered).map(rackName => {
      return domainRegistered[rackName]
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

  console.log(`Promise.map`, { domain });

  domain = await Promise$1.map(domain, async rack => {
    Transformers[`$${rack.name}`] = rack.duckModel.schema;
    const name = rack.name;

    const toMerge = [
      {
        name,
        path: `/${name}`
      },
      pick(rack, Entity.ownPaths),
      {
        methods: mapMethodAccess(Utils.find(domainMethodsAccess, `${rack.name}.methods`))
      }
    ];
    const pl = merge.all(toMerge, {
      isMergeableObject: isPlainObject
    });

    return Entity.parse(pl)
  });

  const domainEndpoints = flattenDeep(await Promise$1.map(domain, entity => {
    return duckRackToCrudEndpoints(entity, DuckStorage.getRackByName(entity.name))
  }));

  const gateways = gatewaysDir ? await grabClasses(gatewaysDir) : [];

  console.log(`Promise.map`, { gateways });
  const gatewaysEndpoints = flattenDeep(await Promise$1.map(gateways, gatewayToCrudEndpoints));

  const services = servicesDir ? await grabClasses(servicesDir) : [];

  console.log(`Promise.map`, {services});
  const servicesEndpoints = flattenDeep(await Promise$1.map(services, gatewayToCrudEndpoints));

  const registeredEntities = {};

  domain.forEach(({ name, duckModel }) => {
    registeredEntities[kebabCase(name)] = cleanDeep(schemaValidatorToJSON(duckModel.schema, { includeAllSettings: false }));
  });

  // return schemas
  domainRouter.get('/', ctx => {
    // todo: filter per user-permission
    ctx.$pleasure.response = registeredEntities;
  });

  // event wiring
  // todo: permissions
  // todo: move to a plugin
  // returns array of rooms
  const getDeliveryDestination = (event, payload) => {
    const delivery = Utils.find(domainCrudDelivery, `${payload.entityName}.delivery`) || true;

    const processOutput = (output) => {
      return typeof output === 'boolean' ? output : castArray(delivery)
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
    const responseType = ctx.response.type;
    if (ctx.body === undefined) {
      if (ctx.leaveAsIs) {
        ctx.body = ctx.$pleasure.response;
      }
      else {
        const data = ctx.$pleasure.response || {};
        ctx.body = {
          code: 200,
          data,
        };
      }

      if (responseType) {
        ctx.set('Content-Type', responseType);
      }
    }
  });

  servicesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, servicesRouter));
  domainEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, domainRouter));
  gatewaysEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, gatewaysRouter));
  pluginsEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, pluginsRouter));
  routesEndpoints.forEach(crudEndpointIntoRouter.bind(undefined, mainRouter));

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
      paths: (await Promise$1.map(endpoints, crudEndpointToOpenApi)).reduce((output, newRoute) => {
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

  if (withSwagger) {
    const swaggerHtml = fs.readFileSync(path.join(findPackageJson(__dirname), '../src/lib/fixtures/swagger.html')).toString();

    const servicesSwagger = JSON.stringify(await endpointsToSwagger(servicesEndpoints, {
      prefix: servicesPrefix
    }), null, 2);

    const domainSwagger = JSON.stringify(await endpointsToSwagger(domainEndpoints, {
      prefix: domainPrefix
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

    domainRouter.get('/swagger.json', async (ctx) => {
      ctx.leaveAsIs = true;
      ctx.body = domainSwagger;
    });
    domainRouter.get('/docs', async (ctx) => {
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

  app.use(domainRouter.routes());
  app.use(domainRouter.allowedMethods());

  app.use(gatewaysRouter.routes());
  app.use(gatewaysRouter.allowedMethods());

  app.use(pluginsRouter.routes());
  app.use(pluginsRouter.allowedMethods());

  // not found
  app.use(() => {
    throw new ApiError(404)
  });

  return { io, mainRouter, servicesRouter, domainRouter, routesEndpoints, servicesEndpoints, domainEndpoints, gatewaysRouter, pluginsRouter, DuckStorage, gateways: classesToObj(gateways), services: classesToObj(services), di }
}

/**
 * @param {Object} options
 * @param {String} options.privateKey
 * @param {String} [options.headerName=authorization]
 * @param {String} [options.cookieName=accessToken]
 * @param {String} [options.algorithm=HS256] - see https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
 * @param {Number|String} [options.expiresIn=15 * 60]
 * @return {Function}
 */
function jwtAccess ({
  cookieName = 'accessToken',
  headerName = 'authorization',
  privateKey,
  algorithm = 'HS256',
  expiresIn = '15m', // 15 minutes
  deliveryGroup = () => false
} = {}) {
  return function ({ app, io }) {
    const isValid = (token) => {
      try {
        const user = verify(token, privateKey);
        return (user.exp * 1000) > Date.now() ? user : false
      } catch (err) {
        return false
      }
    };

    const validateToken = (token) => {
      const user = isValid(token);

      if (!user) {
        throw new Error('Invalid token')
      }

      return user
    };

    const getTokenFromHeaders = (headers) => {
      const auth = headers[headerName] || '';
      if (/^Bearer /.test(auth)) {
        return auth.replace(/^Bearer[\s]+(.*)$/, '$1')
      }
    };

    const getTokenFromCookies = (cookies) => {
      return cookie.parse(cookies || '')[cookieName]
    };

    app.use((ctx, next) => {
      ctx.$pleasure.session = {
        // todo: introduce proper options
        authorize (userData, {
          signIn = true,
          tokenSignOptions = {},
          refreshTokenSignOptions = {}
        } = {}) {
          const accessToken = sign(userData, privateKey, {
            algorithm,
            expiresIn,
            ...tokenSignOptions
          });

          // todo: make valid refreshToken
          const refreshToken = sign(userData, privateKey, {
            algorithm,
            expiresIn,
            ...refreshTokenSignOptions
          });

          if (signIn) {
            ctx.cookies.set(cookieName, accessToken);
            ctx.$pleasure.user = ctx.$pleasure.state.user = isValid(accessToken);
          }

          return {
            accessToken,
            refreshToken
          }
        },
        destroy () {
          // todo: maybe introduce async fn for optional callback
          ctx.cookies.set(cookieName, null);
          ctx.$pleasure.user = ctx.$pleasure.state.user = null;
        },
        get user () {
          return ctx.$pleasure.user
        },
        isValid
      };
      return next()
    });

    app.use((ctx, next) => {
      const getToken = () => {
        return getTokenFromHeaders(ctx.req.headers) || ctx.cookies.get(cookieName)
      };

      const token = getToken();

      if (token) {
        const user = isValid(token);

        if (!user) {
          ctx.$pleasure.session.destroy();
          throw new Error('Invalid token')
        }

        ctx.$pleasure.user = user;
        ctx.$pleasure.state.user = user;
      }

      return next()
    });

    io.use((socket, next) => {
      const accessToken = getTokenFromHeaders(socket.request.headers) || getTokenFromCookies(socket.request.headers.cookie);
      let user;

      if (accessToken) {
        try {
          user = validateToken(accessToken);
        } catch (err) {
          return next(err)
        }
      }

      const group = deliveryGroup(user);

      if (group) {
        socket.join(group);
      }

      return next()
    });
  }
}

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  jwtAccess: jwtAccess
});

export { ApiError, index$1 as Schemas, apiSchemaValidationMiddleware, apiSetup, classesToObj, crudEndpointIntoRouter, duckRackToCrudEndpoints, grabClasses, grabClassesSync, loadApiCrudDir, loadEntitiesFromDir, methodsToDuckfficer, index as plugins };
