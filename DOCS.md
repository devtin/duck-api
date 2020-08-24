## Functions

<dl>
<dt><a href="#apiSchemaValidationMiddleware">apiSchemaValidationMiddleware([get], [body])</a> ⇒</dt>
<dd><p>Validates incoming traffic against given schemas</p>
</dd>
<dt><a href="#responseAccessMiddleware">responseAccessMiddleware(levelResolver, permissionByLevel)</a> ⇒ <code>function</code></dt>
<dd></dd>
<dt><a href="#crudEndpointIntoRouter">crudEndpointIntoRouter(router, crudEndpoint)</a></dt>
<dd><p>Takes given crudEndpoint as defined</p>
</dd>
<dt><a href="#loadApiCrudDir">loadApiCrudDir(dir)</a> ⇒ <code><a href="#CRUDEndpoint">Array.&lt;CRUDEndpoint&gt;</a></code></dt>
<dd><p>Look for JavaScript files in given directory</p>
</dd>
<dt><a href="#loadEntitiesFromDir">loadEntitiesFromDir(dir)</a></dt>
<dd><ul>
<li>Reads given directory looking for *.js files and parses them into</li>
</ul>
</dd>
<dt><a href="#loadPlugin">loadPlugin(pluginName, [baseDir])</a> ⇒ <code>function</code></dt>
<dd><p>Resolves given plugin by trying to globally resolve it, otherwise looking in the <code>plugins.dir</code> directory or
resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.</p>
</dd>
<dt><a href="#jwtAccess">jwtAccess(jwtKey, authorizer, options)</a> ⇒ <code><a href="#ApiPlugin">ApiPlugin</a></code></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#EndpointHandler">EndpointHandler</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#CRUD">CRUD</a> : <code>Object</code></dt>
<dd><p>An object representing all CRUD operations including listing and optional hook for any request.</p>
</dd>
<dt><a href="#CRUDEndpoint">CRUDEndpoint</a> : <code>Object</code></dt>
<dd><p>A CRUD representation of an endpoint</p>
</dd>
<dt><a href="#Entity">Entity</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ApiPlugin">ApiPlugin</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#Authorization">Authorization</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#Authorizer">Authorizer</a> ⇒ <code><a href="#Authorization">Authorization</a></code> | <code>void</code></dt>
<dd></dd>
</dl>

<a name="apiSchemaValidationMiddleware"></a>

## apiSchemaValidationMiddleware([get], [body]) ⇒
Validates incoming traffic against given schemas

**Kind**: global function  
**Returns**: Function - Koa middleware  
**Throws**:

- <code>Schema~ValidationError</code> if any validation fails


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [get] | <code>Schema</code> \| <code>Object</code> \| <code>Boolean</code> | <code>true</code> | Get (querystring) schema. true for all; false for  none; schema for validation |
| [body] | <code>Schema</code> \| <code>Object</code> \| <code>Boolean</code> | <code>true</code> | Post / Delete / Patch (body) schema. true for all; false for  none; schema for validation |

<a name="responseAccessMiddleware"></a>

## responseAccessMiddleware(levelResolver, permissionByLevel) ⇒ <code>function</code>
**Kind**: global function  

| Param | Type |
| --- | --- |
| levelResolver | <code>function</code> | 
| permissionByLevel |  | 

<a name="crudEndpointIntoRouter"></a>

## crudEndpointIntoRouter(router, crudEndpoint)
Takes given crudEndpoint as defined

**Kind**: global function  

| Param |
| --- |
| router | 
| crudEndpoint | 

<a name="loadApiCrudDir"></a>

## loadApiCrudDir(dir) ⇒ [<code>Array.&lt;CRUDEndpoint&gt;</code>](#CRUDEndpoint)
Look for JavaScript files in given directory

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| dir | <code>String</code> | The directory to look for files |

<a name="loadEntitiesFromDir"></a>

## loadEntitiesFromDir(dir)
- Reads given directory looking for *.js files and parses them into

**Kind**: global function  

| Param |
| --- |
| dir | 

<a name="loadPlugin"></a>

## loadPlugin(pluginName, [baseDir]) ⇒ <code>function</code>
Resolves given plugin by trying to globally resolve it, otherwise looking in the `plugins.dir` directory or
resolving the giving absolute path. If the given pluginName is a function, it will be returned with no further logic.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pluginName | <code>String</code> \| <code>Array</code> \| <code>function</code> |  |
| [baseDir] | <code>String</code> | Path to the plugins dir. Defaults to project's local. |

<a name="jwtAccess"></a>

## jwtAccess(jwtKey, authorizer, options) ⇒ [<code>ApiPlugin</code>](#ApiPlugin)
**Kind**: global function  
**Emits**: <code>event:{Object} created - When a token has been issued</code>, <code>event:{Object} created - When a token has been issued</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| jwtKey | <code>String</code> |  | SSL private key to issue JWT |
| authorizer | [<code>Authorizer</code>](#Authorizer) |  |  |
| options | <code>Object</code> |  |  |
| [options.jwt.headerName] | <code>String</code> | <code>authorization</code> |  |
| [options.jwt.cookieName] | <code>String</code> | <code>accessToken</code> |  |
| [options.jwt.body] | <code>Schema</code> \| <code>Boolean</code> | <code>true</code> |  |
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
<a name="EndpointHandler"></a>

## EndpointHandler : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| handler | <code>function</code> |  |
| [get] | <code>Schema</code> | Schema for the url get query |
| [body] | <code>Schema</code> | Schema for the post body object (not available for get endpoints) |

<a name="CRUD"></a>

## CRUD : <code>Object</code>
An object representing all CRUD operations including listing and optional hook for any request.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [*] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps any kind of requests |
| [create] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps post request |
| [read] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps get requests to an /:id |
| [update] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps patch requests |
| [delete] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps delete requests |
| [list] | [<code>EndpointHandler</code>](#EndpointHandler) | Traps get requests to an entity with optional filters |

<a name="CRUDEndpoint"></a>

## CRUDEndpoint : <code>Object</code>
A CRUD representation of an endpoint

**Kind**: global typedef  
**Extends**: [<code>CRUD</code>](#CRUD)  
**Properties**

| Name | Type |
| --- | --- |
| path | <code>String</code> | 

<a name="Entity"></a>

## Entity : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| file | <code>String</code> |  |
| path | <code>String</code> | URL path of the entity |
| schema | <code>Schema</code> \| <code>Object</code> |  |
| statics | <code>Object</code> |  |
| methods | <code>Object</code> |  |

<a name="ApiPlugin"></a>

## ApiPlugin : <code>function</code>
**Kind**: global typedef  

| Param | Description |
| --- | --- |
| app | The koa app |
| server | The http server |
| io | The socket.io instance |
| router | Main koa router |

<a name="Authorization"></a>

## Authorization : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| user | <code>Object</code> | 
| [expiration] | <code>Number</code> | 
| [algorithm] | <code>String</code> | 

<a name="Authorizer"></a>

## Authorizer ⇒ [<code>Authorization</code>](#Authorization) \| <code>void</code>
**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| payload | <code>Object</code> | Given payload (matched by given schema body, if any) |


* * *

&copy; 2020 Martin Rafael Gonzalez <tin@devtin.io>
