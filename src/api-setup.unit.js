import test from 'ava'
import io from 'socket.io-client'
import axios from 'axios'
import Promise from 'bluebird'
import apiSetup from '../test/api-setup.js'

apiSetup()

test(`connects socket.io`, t => {
  return new Promise((resolve, reject) => {
    const socket = io('http://localhost:3000')
    socket.on('connect', () => {
      t.pass()
      resolve()
    })
    socket.on('error', reject)
    setTimeout(reject, 3000)
  })
})

test.only(`proxies emitted events via socket.io`, async t => {
  const socket = io('http://localhost:3000')
  await new Promise((r) => socket.on('connect', r))

  const eventReceived = []

  socket.on('method', p => {
    eventReceived.push(p)
  })

  const { data: { data } } = await axios.post('http://localhost:3000/racks/test', {
    name: 'Martin',
    email: 'tin@devtin.io',
  })
  t.truthy(data)

  const { data: { data: data2 } } = await axios.post(`http://localhost:3000/racks/test/${ data._id }/query`, {
    name: 'Martin',
    email: 'tin@devtin.io',
  })

  t.true(Array.isArray(data2))
  t.snapshot(data2)
  t.true(eventReceived.length > 0)
})

test(`loads api plugins`, async t => {
  const { data: response } = await axios.get('http://localhost:3000/some-plugin')
  t.is(response, 'some plugin here!')
})

test(`provides information about available endpoints / schemas / entities`, async t => {
  const { data: response } = await axios.get('http://localhost:3000/racks')
  t.true(typeof response.data === 'object')
  t.true(Object.hasOwnProperty.call(response.data, 'test'))
})

test(`filters endpoints access`, async t => {
  const { data: response1 } = await axios.get('http://localhost:3000/racks/test/clean')
  t.deepEqual(response1.data, {})

  const { data: response2 } = await axios.get('http://localhost:3000/racks/test/clean?level=1')
  t.deepEqual(response2.data, { name: 'Martin', email: 'tin@devtin.io' })

  const { data: response3 } = await axios.get('http://localhost:3000/racks/test/clean?level=2')
  t.deepEqual(response3.data, { name: 'Martin' })
})

test.todo(`Provides a way of querying multiple endpoints at a time`)
