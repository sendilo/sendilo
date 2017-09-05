// addapted from 'eyeserver/lib/eyeserver.js'
const Eye = require('eyeserver').Eye
const eye = new Eye()
let flags = {}
Eye.flags.forEach((option) => { flags[option.toLowerCase()] = option })
let eyeDebug = false

module.exports = function (server, mount, debug = false) {
  eyeDebug = debug
  server.use(mount, require('body-parser')())
  server.get(mount, handleEyeRequest)
  server.post(mount, handleEyeRequest)
  server.options(mount, handleEyeOptionsRequest)
}

function setDefaultHeaders (req, res) {
  res.header('X-Powered-By', 'EYE Server')
  res.header('Acces-Control-Allow-Origin', '*')
}

function handleEyeOptionsRequest (req, res, next) {
  setDefaultHeaders(req, res)
  res.header('Content-Type', 'text/plain')
  res.send('')
}

function handleEyeRequest (req, res, next) {
  let reqParams = req.query
  let body = req.body || {}
  let data = reqParams.data || []
  let query = reqParams.query || body.query
  let jsonpCallback = reqParams.callback
  let eyeParams = {}
  // make sure data is an array
  if (typeof (data) === 'string') {
    data = data.split(',')
  }
  // add body data
  if (typeof (body.data) === 'string') {
    data.push(body.data)
  } else {
    if (body.data instanceof Array) {
      data.push.apply(data, body.data)
    }
  }
  // collect data and data URIs
  eyeParams.data = []
  // inspect all data parameters in request parameters
  data.forEach((item) => {
    if (!item.match(/^https?:\/\//)) {
      // item is N3 data – push it
      eyeParams.data.push(item)
    } else {
      // item is list of URIs – push each of them
      eyeParams.data.push.apply(eyeParams.data, item.split(','))
    }
  })
  // do a reasoner pass by default
  eyeParams.pass = true
  // add query if present
  if (query) {
    eyeParams.query = query
    delete eyeParams.pass
  }
  // add flags
  for (var param in reqParams) {
    var flag = flags[param.replace(/-/g, '').toLowerCase()]
    if (flag) { eyeParams[flag] = !reqParams[param].match(/^0|false$/i) }
  }
  // add debug information if requested
  if (eyeDebug) { eyeParams.originalUrl = req.originalUrl }
  // execute the reasoner and return result or error
  const eyeStatus = eye.execute(eyeParams, function (error, result) {
    if (!jsonpCallback) {
      setDefaultHeaders(req, res)
      if (!error) {
        res.header('Content-Type', 'text/n3')
        res.send(result + '\n')
      } else {
        res.header('Content-Type', 'text/plain')
        res.send(error + '\n', 400)
      }
    } else {
      res.header('Content-Type', 'application/javascript')
      if (jsonpCallback.match(/^[\w\d\-_]+$/i)) { res.send(jsonpCallback + '(' + JSON.stringify(error || result) + ')') } else { res.send('alert("Illegal callback name.")', 400) }
    }
  })

  // cancel reasoning process if request is closed prematurely
  req.once('close', eyeStatus.cancel.apply(eyeStatus))
}
