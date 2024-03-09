var path = require('path')
var util = require('util')
require('dotenv').load();

var express = require('express');
var session = require('express-session');

var app = express();

app.use(session({
  secret: process.env.SECRET_TOKEN,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  //cookie: { maxAge: 5 * 60 * 1000 },
  resave: true,
  saveUninitialized: true
}));
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

console.log("PORT " + process.env.PORT)
var port = process.env.PORT || 3000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var router = require('./router');

app.get('/', function (req, res) {
  //console.log('load index page /')
  res.redirect('index')
})

app.get('/index', function (req, res) {
  //console.log('load index page /index')
  if (req.query.n != undefined && req.query.n == 1){
    router.logout(req, res)
  }else {
    res.render('index')
  }
})

app.get('/relogin', function (req, res) {
  //console.log('force to relogin')
  if (req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
  if (req.session.hasOwnProperty("extensionId"))
    req.session.extensionId = 0;

  res.render('index')
})

app.get('/login', function (req, res) {
  //req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
  if (!req.session.hasOwnProperty("extensionId"))
    req.session.extensionId = 0;

  router.loadLogin(req, res)
})

app.get('/logout', function (req, res) {
  router.logout(req, res)
})

app.get('/main', function (req, res) {
  console.log('loadMessageStorePage')
  if (req.session.extensionId != 0)
    router.loadMessageStorePage(req, res)
  else{
    res.render('index')
  }
})

app.get('/about', function (req, res) {
  if (req.session.extensionId != 0)
    router.loadHelpPage(req, res)
  else{
    res.render('about')
  }
})

app.get ('/analytics', function (req, res) {
  console.log('loadAnalyticsPage')
  if (req.session.extensionId != 0)
    router.loadAnalyticsPage(req, res)
  else{
    res.render('index')
  }
})

app.get("/poll-new-messages", function (req, res) {
  if (req.session.extensionId != 0)
    router.pollNewMessages(req, res)
  else{
    res.render('index')
  }
})

app.post('/read-message-store', function (req, res) {
  console.log('readMessageStore')
  if (req.session.extensionId != 0)
    router.readMessageList(req, res)
  else{
    res.render('index')
  }
})


app.get('/download-standard-message-report', function (req, res) {
  if (req.session.extensionId != 0)
    router.downloadStandardSMSReport(req, res)
  else{
    res.render('index')
  }
})

app.get('/downloads', function(req, res){
  var file = req.query.filename;
  res.download(file);
});

app.get('/oauth2callback', function(req, res){
  console.log("callback redirected")
  router.login(req, res)
})

app.post('/send-message', function (req, res) {
  console.log("post send message")
  router.sendMessage(req, res)
})

app.post('/sendfeedback', function (req, res) {
  console.log("sendfeedback")
  router.postFeedbackToGlip(req, res)
})

// Receiving RingCentral webhooks notifications
app.post('/webhookcallback', function(req, res) {
    if(req.headers.hasOwnProperty("validation-token")) {
        res.setHeader('Validation-Token', req.headers['validation-token']);
        res.statusCode = 200;
        res.end();
    }else{
      //console.log(res)
        var body = []
        req.on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            body = Buffer.concat(body).toString();
            res.statusCode = 200;
            res.end();
            if (!body || body == ""){
              console.log("Raw body: ", body)
              return
            }
            try {
              var jsonObj = JSON.parse(body)
              if (jsonObj.event.indexOf("/a2p-sms/batches?") >= 0){
                router.processBatchEventNotication(jsonObj)
              }else{
                var aUsers = router.getActiveUsers()
                if (aUsers.length){
                  var eventEngine = aUsers.find(o => o.extensionId === jsonObj.ownerId)
                  if (eventEngine){
                    eventEngine.processNotification(jsonObj)
                  }else{
                    console.log("Not my notification!!!")
                    console.log(jsonObj.event)
                    console.log(jsonObj.subscriptionId)
                    console.log(jsonObj.ownerId)
                    console.log(jsonObj.body.direction)
                  }
                }else{
                  console.log("Not ready. Still loading users")
                }
              }
            }catch (e) {
              console.log("Body is corrupted!", body)
              console.log(e.message)
            }

        });
    }
})

// Test support Glip team
app.get('/support-team', function(req, res){
  res.render('join-support')
})

app.post('/invite-user', function (req, res) {
  router.sendInviteToSupportTeam(req, res)
})
