var Uhura = require('../')

function after (t, fn) {
	return function () {
		t-- && t == 0 && fn()
	}
}

describe('reconnection', function () {
	this.timeout(5000)

	it('should reconnect when autoReconnect is enabled', function (next) {
		var server = Uhura.createServer(function (s) {
		  setTimeout(function () {
			  s.socket.end()
			}, 100)
		})
		server.listen(3333)

		var c = Uhura.createClient(3333)
		c.autoReconnect()

	  c.on('connect', after(2, function () {
			server.close(next)
			c.disconnect()
	  }))
	})

	it('should continue receiving events after reconnection', function (next) {
		var done = after(2, function () {
			c.disconnect()
			server.close(next)
		})

		var count = 0
		var server = Uhura.createServer(function (s) {
			count++

			s.on('ping', function () {
				if (count === 1) {
					s.disconnect()
				}
				done()
			})
		}).listen(4444)

		var c = Uhura.createClient(4444)
	  c.autoReconnect()
	  c.on('connect', function () {
			c.send('ping')
		})
	})

	it('should not lose messages while disconnected', function (next) {
		var sent = []
			, received = []
			, done = function () {}

		var server = Uhura.createServer(function (socket) {
			// Disconnect after 250ms
			setTimeout(function () {
				socket.disconnect()
				done()
			}, 250)

			// Push received pings to list
			socket.on('ping', function (v) {
				received.push(v)
			})
		}).listen(5555)

		var c = Uhura.createClient(5555)

		// Send messages repeatedly
		var timer = setInterval(function () {
			var num = Math.floor(Math.random() * 1000)
			c.send('ping', num)
			sent.push(num)
		}, 100)

	  c.on('connect', after(3, function () {
  		clearInterval(timer)
  		done = function () {
	  		for (var i = 0; i < sent.length; i++) {
		  		sent[i].should.equal(received[i])
		  	}
		  	server.close(next)
  		}
  		c.disconnect()
		}))
	  c.autoReconnect()
	})
})