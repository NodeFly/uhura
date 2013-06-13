# Uhura
[![Build Status](https://travis-ci.org/NodeFly/uhura.png)](https://travis-ci.org/NodeFly/uhura)

Uhura is a server-to-server event emitter wire protocol. It provides a shared event emitter and data store between a server and client, with automatic reconnection and exponential backoff logic.

## Install

    npm install uhura

## Usage
    
    var server = Uhura.createServer(function (client) {
      client.on('ping', function () {
        client.send('pong')
      })
    })
    server.listen(5555)

    var client = Uhura.createClient(5555)
    client.on('pong', function () {
      console.log('pong received')
    })
    client.send('ping')

## API

### Uhura.createServer([options,] cb)

Creates a net server that uses an event emitter to communicate. Callback
receives a connection object for each new incoming connection.

Returns a net.server, must call .listen() on it.

options.store, key/value store, will be used as store[KEY] = VAL, when client
does .set()

defaults to connect/lib/middleware/session/memory, but something else should be
used in production

options.cookie, options.store.cookie = new Cookie(options.cookie)

defaults to {}, not sure intended usage


### Uhura.createClient(port [, host] [, cb]) returns client emitter
Create a client emitter. The port argument may be a number, a string, or an existing net.connect() instance. It also attaches a few extra methods, as seen below.

### client.reconnect()
Forcefully destroys the socket and reconnects.

### client.autoReconnect()
Flag the client to automatically reconnect, which an exponential backoff mechanism.

### client.disconnect()
Disable auto-reconnection, if enabled, and closes the socket.

XXX below APIs are supported by both the client, as well as a connection object

### client.send(event [, args...])
This is identical to the interface for the emit() function seen on normal event emitters, except it sends to the remote server.

### client.set(key, val)
Sets a value in the shared data store. This is also used to store session id for reconnection.

Client key/values in session are synced across on reconnections, and sent on
change.

Server side key/values are stuck into  createServer()'s options.session. On
incoming connection, the session.sessionID is set across to the client.

### client.get([key])

Gets a value from the shared data store.

if no key, return session object (a plain object on client, a connect
    middleware session on server)

---

### Copyright (c) 2013 NodeFly
#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
