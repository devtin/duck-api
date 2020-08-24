<div><h1>duck-api</h1></div>

<p>
    <a href="https://www.npmjs.com/package/duck-api" target="_blank"><img src="https://img.shields.io/npm/v/duck-api.svg" alt="Version"></a>
<a href="http://opensource.org/licenses" target="_blank"><img src="http://img.shields.io/badge/License-MIT-brightgreen.svg"></a>
</p>

<p>
    
</p>

## Installation

```sh
$ npm i duck-api --save
# or
$ yarn add duck-api
```

## Features

- [Connects socket.io](#connects-socket-io)
- [Load api plugins](#load-api-plugins)
- [Accepts complex params via post through the get method](#accepts-complex-params-via-post-through-the-get-method)
- [Provides information about available endpoints / schemas / entities](#provides-information-about-available-endpoints-schemas-entities)
- [Filters access](#filters-access)
- [Provides a way of querying multiple endpoints at a time](#provides-a-way-of-querying-multiple-endpoints-at-a-time)
- [Restricts access via get variables](#restricts-access-via-get-variables)
- [Restricts post / patch / delete body](#restricts-post-patch-delete-body)
- [converts client into a crud-endpoint](#converts-client-into-a-crud-endpoint)
- [Hooks ApiEndpoint into a koa router](#hooks-api-endpoint-into-a-koa-router)
- [converts a crud endpoint in an open api route](#converts-a-crud-endpoint-in-an-open-api-route)
- [Converts an entity into an array of crud endpoints](#converts-an-entity-into-an-array-of-crud-endpoints)
- [translates directory into routes](#translates-directory-into-routes)
- [Load entities from directory](#load-entities-from-directory)
- [Signs JWT sessions](#signs-jwt-sessions)
- [Validates provided token via head or cookie and sets $pleasure.user when valid](#validates-provided-token-via-head-or-cookie-and-sets-pleasure-user-when-valid)
- [Filters response data](#filters-response-data)
- [converts route tree into crud endpoint](#converts-route-tree-into-crud-endpoint)
- [Parses query objects](#parses-query-objects)


<a name="connects-socket-io"></a>

## Connects socket.io


```js
return new Promise((resolve, reject) => {
  const socket = io('http://localhost:3000')
  socket.on('connect', () => {
    t.pass()
    resolve()
  })
  socket.on('error', reject)
  setTimeout(reject, 3000)
})
```

<a name="load-api-plugins"></a>

## Load api plugins


```js
const { data: response } = await axios.get('http://localhost:3000/some-plugin')
t.is(response.data, 'some plugin here!')
```

<a name="accepts-complex-params-via-post-through-the-get-method"></a>

## Accepts complex params via post through the get method


```js
const $params = {
  name: 'Martin',
  skills: [{
    name: 'developer'
  }]
}
const { data: response } = await axios.get('http://localhost:3000/params', {
  data: {
    $params
  }
})
t.deepEqual(response.data, $params)
```

<a name="provides-information-about-available-endpoints-schemas-entities"></a>

## Provides information about available endpoints / schemas / entities


```js
const { data: response } = await axios.get('http://localhost:3000/racks')
t.true(typeof response.data === 'object')
t.true(Object.hasOwnProperty.call(response.data, 'test'))
/*
  t.deepEqual(response.data.test, {
    schema: {
      name: {
        type: 'String'
      }
    }
  })
*/
```

<a name="filters-access"></a>

## Filters access


```js
const { data: response1 } = await axios.get('http://localhost:3000/racks/test/clean')
t.deepEqual(response1.data, {})

const { data: response2 } = await axios.get('http://localhost:3000/racks/test/clean?level=1')
t.deepEqual(response2.data, { name: 'Martin', email: 'tin@devtin.io' })

const { data: response3 } = await axios.get('http://localhost:3000/racks/test/clean?level=2')
t.deepEqual(response3.data, { name: 'Martin' })
```

<a name="provides-a-way-of-querying-multiple-endpoints-at-a-time"></a>

## Provides a way of querying multiple endpoints at a time




<a name="restricts-access-via-get-variables"></a>

## Restricts access via get variables


```js
const Api = apiSchemaValidationMiddleware({
  // passes the schema
  get: {
    quantity: {
      type: Number,
      required: false
    }
  }
})

const none = Object.assign({}, ctxStub, requestCtx.none)
Api(none, fnStub)

t.truthy(none.$pleasure.get)
t.is(Object.keys(none.$pleasure.get).length, 0)

const quantity = Object.assign({}, ctxStub, requestCtx.quantity)
Api(quantity, fnStub)

t.truthy(quantity.$pleasure.get)
t.is(quantity.$pleasure.get.quantity, 3)

const wrongQuantity = Object.assign({}, ctxStub, requestCtx.wrongQuantity)
const error = t.throws(() => Api(wrongQuantity, fnStub))

t.is(error.message, 'Data is not valid')
t.is(error.errors.length, 1)
t.is(error.errors[0].message, 'Invalid number')
t.is(error.errors[0].field.fullPath, 'quantity')
```

<a name="restricts-post-patch-delete-body"></a>

## Restricts post / patch / delete body


```js
const Api = apiSchemaValidationMiddleware({
  body: {
    name: {
      type: String,
      required: [true, `Please enter your full name`]
    },
    birthday: {
      type: Date
    }
  }
})

const fullContact = Object.assign({}, ctxStub, requestCtx.fullContact)
const wrongContact = Object.assign({}, ctxStub, requestCtx.wrongContact)
t.notThrows(() => Api(fullContact, fnStub))

t.is(fullContact.$pleasure.body.name, 'Martin Rafael Gonzalez')
t.true(fullContact.$pleasure.body.birthday instanceof Date)

const error = t.throws(() => Api(wrongContact, fnStub))
t.is(error.message, 'Data is not valid')
t.is(error.errors.length, 1)
t.is(error.errors[0].message, `Invalid date`)
t.is(error.errors[0].field.fullPath, `birthday`)
```

<a name="converts-client-into-a-crud-endpoint"></a>

## converts client into a crud-endpoint


```js
const client = Client.parse({
  name: 'PayPal',
  methods: {
    issueTransaction: {
      description: 'Issues a transaction',
      input: {
        name: String
      },
      handler ({ name }) {
        return name
      }
    },
    issueRefund: {
      description: 'Issues a refund',
      input: {
        transactionId: Number
      },
      handler ({transactionId}) {
        return transactionId
      }
    }
  }
})

const crudEndpoints = clientToCrudEndpoints(client)
crudEndpoints.forEach(crudEndpoint => {
  t.true(CRUDEndpoint.isValid(crudEndpoint))
})
```

<a name="hooks-api-endpoint-into-a-koa-router"></a>

## Hooks ApiEndpoint into a koa router


```js
crudEndpointIntoRouter(koaRouterMock, {
  create: { handler () { } },
  read: { handler () { } },
  update: { handler () { } },
  delete: { handler () { } }
})
t.true(koaRouterMock.post.calledOnce)
t.true(koaRouterMock.get.calledOnce)
t.true(koaRouterMock.patch.calledOnce)
t.true(koaRouterMock.delete.calledOnce)
```

<a name="converts-a-crud-endpoint-in-an-open-api-route"></a>

## converts a crud endpoint in an open api route


```js
const swaggerEndpoint = crudEndpointToOpenApi(crudEndpoint)
t.truthy(swaggerEndpoint)
t.snapshot(swaggerEndpoint)
```

<a name="converts-an-entity-into-an-array-of-crud-endpoints"></a>

## Converts an entity into an array of crud endpoints


```js
const converted = entityToCrudEndpoints(anEntity, entityDriver)
t.true(Array.isArray(converted))

t.is(converted.length, 4)

converted.forEach(entity => {
  t.notThrows(() => CRUDEndpoint.parse(entity))
})

t.is(converted[0].path, '/papo')
t.truthy(converted[0].create)
t.truthy(converted[0].read)
t.truthy(converted[0].update)
t.truthy(converted[0].delete)
t.truthy(converted[0].list)
t.is(converted[1].path, '/papo/sandy-papo')
t.truthy(converted[1].create)
t.is(converted[3].path, '/papo/:id/huele-pega')
```

<a name="translates-directory-into-routes"></a>

## translates directory into routes


```js
const routes = await loadApiCrudDir(path.join(__dirname, './fixtures/app-test/api'))
t.is(routes.length, 5)
```

<a name="load-entities-from-directory"></a>

## Load entities from directory


```js
const entities = await loadEntitiesFromDir(path.join(__dirname, './fixtures/app-test/entities'))
t.is(entities.length, 1)
t.truthy(typeof entities[0].duckModel.clean)
```

<a name="signs-jwt-sessions"></a>

## Signs JWT sessions


```js
// initialize
const plugin = jwtAccess(jwtKey, v => v)

const ctx = ctxMock({
  body: {
    name: 'Martin',
    email: 'tin@devtin.io'
  }
})

const router = routerMock()
plugin({ router })

// 0 = index of the use() call; 2 = index of the argument passed to the use() fn
const middleware = findMiddlewareByPath(router, 'auth', 1)

// running middleware
await t.notThrowsAsync(() => middleware(ctx))

const { accessToken } = ctx.body

t.truthy(accessToken)
t.log(`An access token was returned in the http response`)

t.truthy(ctx.cookies.get('accessToken'))
t.log(`A cookie named 'accessToken' was set`)

t.is(accessToken, ctx.cookies.get('accessToken'))
t.log(`Access cookie token and http response token match`)

const decodeToken = jwtDecode(accessToken)

t.is(decodeToken.name, ctx.$pleasure.body.name)
t.is(decodeToken.email, ctx.$pleasure.body.email)
t.log(`Decoded token contains the data requested to sign`)

t.notThrows(() => verify(accessToken, jwtKey))
t.log(`token was signed using given secret`)
```

<a name="validates-provided-token-via-head-or-cookie-and-sets-pleasure-user-when-valid"></a>

## Validates provided token via head or cookie and sets $pleasure.user when valid


```js
// initialize
const plugin = jwtAccess(jwtKey, v => v)
const router = routerMock()

plugin({ router })

const middleware = findMiddlewareByPath(router, 0)
const accessToken = sign({ name: 'Martin' }, jwtKey)

const ctx = ctxMock({
  cookies: {
    accessToken
  }
})

t.notThrows(() => middleware(ctx, next))

t.truthy(ctx.$pleasure.user)
t.is(ctx.$pleasure.user.name, 'Martin')

const err = await t.throwsAsync(() => middleware(ctxMock({
  cookies: {
    accessToken: sign({ name: 'Martin' }, '123')
  }
}), next))

t.is(err.message, 'Unauthorized')
t.is(err.code, 401)

const err2 = await t.throwsAsync(() => middleware(ctxMock({
  cookies: {
    accessToken
  },
  headers: {
    authorization: `Bearer ${ accessToken }1`
  }
}), next))

t.is(err2.message, 'Bad request')
t.is(err2.code, 400)
```

<a name="filters-response-data"></a>

## Filters response data


```js
const next = (ctx) => () => {
  Object.assign(ctx, { body: Body })
}
const Body = {
  firstName: 'Martin',
  lastName: 'Gonzalez',
  address: {
    street: '2451 Brickell Ave',
    zip: 33129
  }
}
const ctx = (level = 'nobody', body = Body) => {
  return {
    body: {},
    $pleasure: {
      state: {}
    },
    user: {
      level
    }
  }
}
const middleware = responseAccessMiddleware(EndpointHandler.schemaAtPath('access').parse(ctx => {
  if (ctx.user.level === 'nobody') {
    return false
  }
  if (ctx.user.level === 'admin') {
    return true
  }
  return ['firstName', 'lastName', 'address.zip']
}))

const nobodyCtx = ctx('nobody')
await middleware(nobodyCtx, next(nobodyCtx))
t.deepEqual(nobodyCtx.body, {})

const userCtx = ctx('user')
await middleware(userCtx, next(userCtx))
t.deepEqual(userCtx.body, {
  firstName: 'Martin',
  lastName: 'Gonzalez',
  address: {
    zip: 33129
  }
})

const adminCtx = ctx('admin')
await middleware(adminCtx, next(adminCtx))
t.deepEqual(adminCtx.body, Body)
```

<a name="converts-route-tree-into-crud-endpoint"></a>

## converts route tree into crud endpoint


```js
const routeTree = {
  somePath: {
    to: {
      someMethod: {
        read: {
          description: 'Some method description',
          handler () {

          },
          get: {
            name: String
          }
        }
      }
    }
  },
  and: {
    otherMethod: {
      create: {
        description: 'create one',
        handler () {

        }
      },
      read: {
        description: 'read one',
        handler () {

        }
      }
    },
    anotherMethod: {
      create: {
        description: 'another one (another one)',
        handler () {

        }
      }
    }
  }
}

const endpoints = routeToCrudEndpoints(routeTree)
t.truthy(endpoints)
t.snapshot(endpoints)
```

<a name="parses-query-objects"></a>

## Parses query objects


```js
const parsed = Query.parse({
  address: {
    zip: {
      $gt: 34
    }
  }
})

t.deepEqual(parsed, {
  address: {
    zip: {
      $gt: 34
    }
  }
})
```


<br><a name="apiSchemaValidationMiddleware"></a>

### apiSchemaValidationMiddleware([get], [body]) ⇒
**Throws**:

- <code>Schema~ValidationError</code> if any validation fails


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [get] | <code>Schema</code>, <code>Object</code>, <code>Boolean</code> | <code>true</code> | Get (querystring) schema. true for all; false for  none; schema for validation |
| [body] | <code>Schema</code>, <code>Object</code>, <code>Boolean</code> | <code>true</code> | Post / Delete / Patch (body) schema. true for all; false for  none; schema for validation |

**Returns**: Function - Koa middleware  
**Description:**

Validates incoming traffic against given schemas


<br><a name="responseAccessMiddleware"></a>

### responseAccessMiddleware(access) ⇒ <code>function</code>

| Param | Type | Description |
| --- | --- | --- |
| access | <code>function</code> | callback function receives ctx |


<br><a name="crudEndpointIntoRouter"></a>

### crudEndpointIntoRouter(router, crudEndpoint)

| Param |
| --- |
| router | 
| crudEndpoint | 

**Description:**

Takes given crudEndpoint as defined


<br><a name="loadApiCrudDir"></a>

### loadApiCrudDir(dir) ⇒ [<code>Array.&lt;CRUDEndpoint&gt;</code>](#CRUDEndpoint)

| Param | Type | Description |
| --- | --- | --- |
| dir | <code>String</code> | The directory to look for files |

**Description:**

Look for JavaScript files in given directory


<br><a name="loadEntitiesFromDir"></a>

### loadEntitiesFromDir(dir)

| Param |
| --- |
| dir | 

**Description:**

Reads given directory looking for *.js files and parses them into


<br><a name="entityToCrudEndpoints"></a>

### entityToCrudEndpoints(entity, entityDriver) ⇒

| Param |
| --- |
| entity | 
| entityDriver | 

**Returns**: Promise<[]|*>  

<br><a name="loadPlugin"></a>

### loadPlugin(pluginName, [baseDir]) ⇒ <code>function</code>

| Param | Type | Description |
| --- | --- | --- |
| pluginName | <code>String</code>, <code>Array</code>, <code>function</code> |  |
| [baseDir] | <code>String</code> | Path to the plugins dir. Defaults to project's local. |

**Description:**

Resolves given plugin by trying to globally resolve it, otherwise looking in the `plugins.dir` directory or
resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.


<br><a name="jwtAccess"></a>

### jwtAccess(jwtKey, authorizer, options) ⇒ [<code>ApiPlugin</code>](#ApiPlugin)
**Emits**: <code>event:{Object} created - When a token has been issued</code>, <code>event:{Object} created - When a token has been issued</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| jwtKey | <code>String</code> |  | SSL private key to issue JWT |
| authorizer | [<code>Authorizer</code>](#Authorizer) |  |  |
| options | <code>Object</code> |  |  |
| [options.jwt.headerName] | <code>String</code> | <code>authorization</code> |  |
| [options.jwt.cookieName] | <code>String</code> | <code>accessToken</code> |  |
| [options.jwt.body] | <code>Schema</code>, <code>Boolean</code> | <code>true</code> |  |
| [options.jwt.algorithm] | <code>String</code> | <code>HS256</code> |  |
| [options.jwt.expiresIn] | <code>String</code> | <code>15 * 60</code> |  |

**Example**  
```js
// pleasure.config.js
{
  plugins: [
    jwtAccess(jwtKey, authorizer, { jwt: { body: true, algorithm: 'HS256', expiryIn: 15 * 60 * 60 } })
  ]
}
```

<br><a name="EndpointHandler"></a>

### EndpointHandler : <code>Object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| handler | <code>function</code> |  |
| [access] | <code>Access</code> | Schema for the url get query |
| [get] | <code>Schema</code> | Schema for the url get query |
| [body] | <code>Schema</code> | Schema for the post body object (not available for get endpoints) |


<br><a name="CRUD"></a>

### CRUD : <code>Object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [*] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps any kind of requests |
| [create] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps post request |
| [read] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps get requests to an /:id |
| [update] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps patch requests |
| [delete] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps delete requests |
| [list] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps get requests to an entity with optional filters |

**Description:**

An object representing all CRUD operations including listing and optional hook for any request.


<br><a name="CRUDEndpoint"></a>

### CRUDEndpoint : <code>Object</code>
**Extends**: [<code>CRUD</code>](#CRUD)  
**Properties**

| Name | Type |
| --- | --- |
| path | <code>String</code> | 

**Description:**

A CRUD representation of an endpoint


<br><a name="Entity"></a>

### Entity : <code>Object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| file | <code>String</code> |  |
| path | <code>String</code> | URL path of the entity |
| schema | <code>Schema</code> \| <code>Object</code> |  |
| methods | <code>Object</code> |  |


<br><a name="ApiPlugin"></a>

### ApiPlugin : <code>function</code>

| Param | Description |
| --- | --- |
| app | The koa app |
| server | The http server |
| io | The socket.io instance |
| router | Main koa router |


<br><a name="Authorization"></a>

### Authorization : <code>Object</code>
**Properties**

| Name | Type |
| --- | --- |
| user | <code>Object</code> | 
| [expiration] | <code>Number</code> | 
| [algorithm] | <code>String</code> | 


<br><a name="Authorizer"></a>

### Authorizer ⇒ [<code>Authorization</code>](#Authorization) \| <code>void</code>

| Param | Type | Description |
| --- | --- | --- |
| payload | <code>Object</code> | Given payload (matched by given schema body, if any) |


* * *

### License

[MIT](https://opensource.org/licenses/MIT)

&copy; 2020-present Martin Rafael Gonzalez <tin@devtin.io>
