const pgdb = require('./db')
require('dotenv').load()
var users = []

createAccountTable()

async function createAccountTable() {
  var query = 'CREATE TABLE IF NOT EXISTS social_msg_accounts '
  query += "(acct_id VARCHAR(16) PRIMARY KEY, subscription_id VARCHAR(48) NOT NULL, connected_channels JSONB NOT NULL)"
  var result =await pgdb.createTableAsync(query)
  if (!result) {
      console.log("Error creating table")
  }else{
      console.log("createAccountTable DONE")
      await createUserTable()
  }
}

async function createUserTable() {
  var query = 'CREATE TABLE IF NOT EXISTS social_msg_users '
  query += "(user_id VARCHAR(16) PRIMARY KEY, acct_id VARCHAR(16) NOT NULL, displayed_channels JSONB DEFAULT '[]')"
  var result =await pgdb.createTableAsync(query)
  if (!result) {
      console.log("Error creating table")
  }else{
      console.log("createUserTable DONE")
  }
}

function getUserIndex(id){
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (user != null){
      if (id == user.getUserId()){
        return i
      }
    }
  }
  return -1
}

function getUserIndexByExtensionId(extId){
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (extId == user.getExtensionId()){
      return i
    }
  }
  return -1
}

function makeId() {
  var text = "";
  var possible = "-~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 1; i < 65; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

var router = module.exports = {
  removeMe: function(extensionId, remove){
    var index = getUserIndexByExtensionId(extensionId)
    if (index >= 0){
      if (remove == 1){
        users[index] = null
        users.splice(index, 1);
        console.log("Number of online users: " + users.length)
      }else{
        console.log("There are pending batches => Keep waiting")
      }
    }
  },
  loadLogin: async function(req, res){
    if (req.session.userId == 0 || req.session.extensionId == 0) {
      var id = makeId()
      req.session.userId = id;
      //console.log(id)
      var user = new (require('./usershandler.js'))(id);
      // close to try new code
      console.log("ADD NEW USER")
      users.push(user)
      var p = user.getPlatform()
      if (p != null){
        p.loginUrl({
          brandId: process.env.RINGCENTRAL_BRAND_ID,
          redirectUri: process.env.RC_APP_REDIRECT_URL,
          state: id
        })
        res.render('login', {
          authorize_uri: p.loginUrl({
            brandId: "",
            redirectUri: process.env.RC_APP_REDIRECT_URL,
            state: id
          }),
          redirect_uri: process.env.RC_APP_REDIRECT_URL,
          token_json: ''
        });
      }
    }else{
      console.log("Must be a reload page")
      var index = getUserIndex(req.session.userId)
      if (index >= 0){
        var check = await users[index].loadConversationPage(res)
        if (!check){
          users.splice(index, 1)
          this.forceLogin(req, res)
        }
      }else{
        this.forceLogin(req, res)
      }
    }
  },
  forceLogin: function(req, res){
    console.log("FORCE LOGIN")
    if (req.session){
      req.session.destroy();
    }
    res.render('index')
  },
  login: function(req, res){
    console.log("Auth code arrives")
    var index = getUserIndex(req.query.state)
    if (index < 0)
      return this.forceLogin(req, res)
    var thisUser = this
    //users[index].login(req, res, function(err, extensionId){
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        var duplicatedUser = users.filter(u => u.extensionId == extensionId)
        var pro = process.memoryUsage()
        console.log("After Heap Total: " + (pro.heapTotal/1024).toFixed(1) + ". Used: " + (pro.heapUsed/1024).toFixed(1))

        if (duplicatedUser && duplicatedUser.length > 1){
          console.log("Has duplicated users")
          for (var dupUser of duplicatedUser){
            if (dupUser.userId != req.query.state){
              var remUserIndex = users.findIndex(u => u.userId == dupUser.userId)
              if (remUserIndex >= 0){
                console.log("remove dupUser")
                users.splice(remUserIndex, 1)
              }
            }
          }
        }
        //console.log("USERS", users)
      }else{
        // login failed => remove this user and force relogin
        console.log("login failed => remove this user and force relogin")
        users.splice(index, 1)
        thisUser.forceLogin(req, res)
      }
    })
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return this.forceLogin(req, res)
    }
    var thisObj = this
    // check size, memory
    var pro = process.memoryUsage()
    console.log("Before Heap Total: " + (pro.heapTotal/1024).toFixed(1) + ". Used: " + (pro.heapUsed/1024).toFixed(1))
    users[index].logout(function(err, result) {
      if (result == 1){
        console.log("Number of online users before null: " + users.length)
        users[index] = null
        console.log("Number of online users after null: " + users.length)
        users.splice(index, 1);
        thisObj.forceLogin(req, res)
        console.log("Number of online users: " + users.length)
        //check size, memory
        try {
          if (global.gc) {
              console.log("calling gc")
              global.gc();
            }
        } catch (e) {
          console.log("`node --expose-gc index.js`");
          //process.exit();
        }
        var pro = process.memoryUsage()
        console.log("After Heap Total: " + (pro.heapTotal/1024).toFixed(1) + ". Used: " + (pro.heapUsed/1024).toFixed(1))
      }else{
        console.log("There are pending batches => Logout but don't delete the user object!")
        console.log("Number of online users: " + users.length)
        thisObj.forceLogin(req, res)
      }
    })
  },
  pollNewMessages: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].pollNewMessages(res)
  },
  checkSendMessageStatus: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    console.log("checkSendMessageStatus()", req.query.id)
    users[index].checkSendMessageStatus(req.query.id, res)
  },
  readMessageList: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readMessageList(req, res, "")
  },
  getMessagingAnalytics: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getMessagingAnalytics(req, res)
  },
  getAnswer: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getAnswer(req.body.message, res)
  },
  pollAnalyticsResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].pollAnalyticsResult(res)
  },
  downloadAnalytics: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadAnalytics(req, res)
  },
  downloadStandardSMSReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadStandardSMSReport(req, res)
  },
  sendMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendMessage(req, res)
  },
  saveUserSettings: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].saveUserSettings(req.body, res)
  },
  registerNewChannel: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].registerNewChannel(req.body, res)
  },
  unregisterChannel: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].unregisterChannel(req.query.id, res)
  },
  initiateFBConversation: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].initiateFBConversation(req, res)
  },
  initiateWAConversation: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].initiateWAConversation(req, res)
  },
  postFeedbackToGlip: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].postFeedbackToGlip(req)
    res.send({"status":"ok","message":"Thank you for sending your feedback!"})
  },
  loadConversationPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadConversationPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadAnalyticsPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadAnalyticsPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadSettingsPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadSettingsPage(res)
  },
  sendInviteToSupportTeam: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendInviteToSupportTeam(req, res)
  },
  processEventNotication: function(eventObj){
    var index = getUserIndexByExtensionId(eventObj.ownerId)
    if (index < 0)
      return console.log("not found this user")
    users[index].processEventNotication(eventObj)
  }
}
