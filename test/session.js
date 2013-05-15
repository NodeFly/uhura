// var Uhura = require('../')

// function after (t, fn) {
// 	return function () {
// 		t-- && t == 0 && fn()
// 	}
// }

// describe('session', function () {
// 	this.timeout(5000)

// 	it('should keep session', function (next) {
// 		var server = Uhura.createServer(function (s) {
// 			// s.socket.end()
// 		}).listen(4567)

// 		var c = Uhura.createClient(4567)
// 	  c.autoReconnect()

// 		var sid
// 		c.once('connect', function () {
// 			sid = c.get('sid')
// 		})

// 		c.on('connect', after(2, function () {
// 			c.disconnect()
// 			if (c.get('sid') !== sid) {
// 				next(new Error('sid does not match'))
// 			}
// 			next()
// 		}))
// 	})
// })