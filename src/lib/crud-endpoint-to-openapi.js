import mapValues from 'lodash/mapValues'
import { Duckfficer } from 'duck-storage'
import { schemaValidatorToJSON } from '@devtin/schema-validator-doc'
import { isNotNullObj } from './is-not-null-obj'
import trim from 'lodash/trim'

const { Schema, Utils } = Duckfficer

const getExample = (schema) => {
  if (schema.settings.example) {
    return schema.settings.example
  }

  if (getType(schema) === 'array' && schema.settings.arraySchema) {
    return [getExample(Schema.ensureSchema(schema.settings.arraySchema))]
  }

  if (!schema.hasChildren) {
    return ''
  }

  const example = {}

  schema.children.forEach(child => {
    if (!/^_/.test(child.name)) {
      example[child.name] = getExample(child)
    }
  })

  return example
}

const getType = (type) => {
  if (typeof type === 'object' && !Array.isArray(type)) {
    if (type.type) {
      return getType(type.type)
    }
    return 'object'
  }

  const foundType = ((typeof type === 'function' ? type.name : type)||'string').toString().toLowerCase()

  const allowed = ['string', 'object' , 'number', 'integer', 'array', 'file', 'date']
  return allowed.indexOf(foundType) >= 0 ? foundType : 'string'
}

const processObject = ({ schema, requestType }) => {
  const properties = {}
  schema.children.forEach((children) => {
    // console.log(`children`, children)

    Object.assign(properties, {
      [children.name]: schemaValidatorToSwagger(children, requestType)
    })
  })
  // console.log(JSON.stringify({ properties }, null,2))
  return {
    properties
  }
}

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
}

const schemaValidatorToSwagger = (schema, requestType) => {
  schema = Schema.ensureSchema(schema)

  // todo: move this somewhere it can be override
  const getOpenApiSettingsForSchema = (schema) => {
    const openApiSettings = {}
    const type = getType(schema)
    const typeFn = schemaTypeToSwagger[type]

    if (typeFn) {
      Object.assign(openApiSettings, typeFn({ requestType, schema })||{})
    }

    return openApiSettings
  }

  const remapContent = (schema) => {
    const obj = schemaValidatorToJSON(schema)
    if (!isNotNullObj(obj)) {
      return obj
    }

    return {
      type: getType(schema),
      ...getOpenApiSettingsForSchema(schema)
    }
  }

  return remapContent(schema)
}

export function crudEndpointToOpenApi (crudEndpoint) {
  const tags = [trim(crudEndpoint.path, '/').split('/')[0]]
  const getPathParams = () => {
    const paramsPattern = /\/:[^/]+(?:\/|$)/g
    const matches = crudEndpoint.path.match(paramsPattern)||[]
    return matches.map((pathName) => {
      pathName = trim(pathName, '/:')
      return {
        name: pathName,
        in: "path",
        description: `${pathName} parameter`,
        required: true,
        style: "simple"
      }
    })
  }

  const getRequestBody = (schema) => {
    if (typeof schema === 'boolean' || !schema) {
      return
    }
    schema = Schema.ensureSchema(schema)
    return {
      description: schema.settings.description,
      content: {
        "multipart/form-data": {
          schema: schemaValidatorToSwagger(schema, 'request'),
          example: getExample(schema)
        }
      }
    }
  }

  const convert = (endpoint) => {
    if (!endpoint) {
      return
    }

    const { summary, description } = endpoint
    const getSchema = Schema.ensureSchema(endpoint.get)
    const getSchemaJson = schemaValidatorToSwagger(getSchema, 'request')

    const requestBody = getRequestBody(endpoint.body)

    const responses = mapValues(endpoint.output, (response, code) => {
      // const { description, summary, example } = response
      const outputSchema = new Schema({
        code: {
          type: Number,
          example: code
        },
        data: response
      })

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
    })

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
    })).filter(Boolean)

    return {
      description,
      summary,
      requestBody,
      parameters,
      tags,
      responses
    }
  }

  const {
    create: post,
    read: get,
    update: patch,
    delete: del,
  } = crudEndpoint

  return {
    [crudEndpoint.path.replace(/\/:([^/]+)(\/|$)/, '/{$1}$2')]: {
      get: convert(get),
      post: convert(post),
      patch: convert(patch),
      delete: convert(del)
    }
  }
}
