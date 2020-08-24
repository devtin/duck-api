import test from 'ava'
import {routeToCrudEndpoints} from './route-to-crud-endpoints'

test('converts route tree into crud endpoint', t => {
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
})
