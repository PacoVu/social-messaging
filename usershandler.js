var fs = require('fs')
const pgdb = require('./db')
const RCPlatform = require('./platform.js')
const ChatGPT = require('./chatgpt.js')
var router = require('./router');

const Analytics = require('./analytics-engine.js')
require('dotenv').load()

const MASK = "#!#"

function User(id) {
  this.userId = id;
  this.extensionId = 0;
  this.accountId = 0;

  this.userEmail = "" // for feedback only
  this.userName = ""
  this.subscriptionId = ""
  this.rc_platform = new RCPlatform(id)
  //this.analytics = new Analytics()
  this.gpt = new ChatGPT()
  this.connectedChannels = []
  this.displayedChannels = []
  this.agentsList = []
  this.contactsList = []
  this.identities = []
  this.newMessages = []
  return this
}

var engine = User.prototype = {
    getUserId: function(){
      return this.userId
    },
    getExtensionId: function(){
      return this.extensionId
    },
    getUserName: function(){
      return this.userName;
    },
    getPlatform: function(){
      return this.rc_platform.getSDKPlatform()
    },
    loadConversationPage: async function(res){
      await this.readUserSettings()
      if (this.connectedChannels.length > 0){
        res.render('main', {
          userName: this.getUserName(),
          channels: this.connectedChannels,
          displayedChannels: this.displayedChannels,
          contacts: this.contactsList
        })
      }else{
        res.render('settings', {
          userName: this.getUserName(),
          channels: this.connectedChannels
        })
      }
      return true
    },
    loadAnalyticsPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Analytics page`)
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }

      if (!this.analytics){
        this.analytics = new Analytics(this.connectedChannels, this.agentsList)
      }

      res.render('analytics', {
        userName: this.getUserName(),
        channels: this.connectedChannels
        //assetsPath: process.env.ASSETS_PATH
      })
      return true
    },
    loadSettingsPage: async function(res){
      res.render('settings', {
          userName: this.getUserName(),
          channels: this.connectedChannels
      })
    },
    login: async function(req, res, callback){
      if (req.query.code) {
        var thisUser = this
        var extensionId = await this.rc_platform.login(req.query.code)
        if (extensionId){
          this.extensionId = extensionId
          req.session.extensionId = extensionId;

          //thisUser.deleteAllRegisteredWebHookSubscriptions()
          var p = await this.rc_platform.getPlatform(this.extensionId)
          if (p){
            try {
              var resp = await p.get("/restapi/v1.0/account/~/extension/~/")
              var jsonObj = await resp.json()
              if (jsonObj.permissions.admin.enabled){
                this.adminUser = true
              }
              this.accountId = jsonObj.account.id
              var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
              if (jsonObj.contact.hasOwnProperty("email"))
                this.userEmail = jsonObj.contact.email
              this.userName = fullName

              // check account settings. If no account settings force to create one from the settings page
              var result = await this.readAccountInfo()
              //console.log("result", result)
              //console.log("channels", this.connectedChannels)

              // Read identities
              await this.listIdentities(p)
              await this.readAgentInfo(p)
              //await this.subscribeForNotification()
              console.log("subscriptionId", this.subscriptionId)
              if (!this.subscriptionId || this.subscriptionId != "")
                await this.renewSubscription(p)
              else
                await this.subscribeForNotification()

            } catch (e) {
              console.log("login() - Failed")
              console.error(e.message);
            }
            callback(null, extensionId)
            res.send('login success');
          }else{
            console.log('login failed: no platform object')
            callback(null, extensionId)
            res.send('login success');
          }
        }else {
          res.send('login failed');
          callback("error", this.extensionId)
        }
      } else {
        res.send('No Auth code');
        callback("error", null)
      }
    },
    readUserSettings: async function(){
      var query = `SELECT displayed_channels FROM social_msg_users WHERE user_id='${this.extensionId}'`
      var result = await pgdb.readAsync(query)
      if (result && result.rows.length > 0){
        this.displayedChannels = result.rows[0].displayed_channels
        return "ok"
      }else{ // no history
        return null
      }
    },
    saveUserSettings: async function(body, res){
      this.displayedChannels = JSON.parse(body.displayedChannels)
      var channelsStr = JSON.stringify(this.displayedChannels)
      var query = "INSERT INTO social_msg_users (user_id, acct_id, displayed_channels)"
      query += " VALUES ($1,$2,$3)"
      var values = [this.extensionId, this.accountId, channelsStr]
      query += ` ON CONFLICT (user_id) DO UPDATE SET displayed_channels='${channelsStr}'`
      //console.log(query)
      var result = await pgdb.insertAsync(query, values)
      var response = {
        status: "ok",
        message: "Saved user settings successfully."
      }
      if (!result){
          console.error("Cannot update displayed channels");
          response.status = "error"
          response.message = "Cannot save user settings"
      }else{
          console.log("Save user settings. DONE");
      }
      res.send(response)
    },
    readAccountInfo: async function(){
      var query = `SELECT subscription_id, connected_channels FROM social_msg_accounts WHERE acct_id='${this.accountId}'`
      var result = await pgdb.readAsync(query)
      if (result && result.rows.length > 0){
        this.connectedChannels = result.rows[0].connected_channels
        this.subscriptionId = result.rows[0].subscription_id
        return "ok"
      }else{ // no history
        return null
      }
    },
    updateSubscriptionId: async function(){
      var query = `UPDATE social_msg_accounts SET subscription_id='${this.subscriptionId}' WHERE acct_id='${this.accountId}'`
      //console.log(query)
      var result = await pgdb.updateAsync(query)
      if (!result){
          console.error("Cannot update subscription id");
      }else{
          console.log("subscription id updated. DONE");
      }
    },
    registerNewChannel: async function(body, res){
      var icon = ""
      switch (body.channelType) {
        case "WhatsApp":
          icon = "fa-whatsapp"
          break;
        case "Twitter":
          icon = "fa-twitter"
          break;
        case "LinkedIn":
          icon = "fa-linkedin"
          break;
        case "FaceBook":
          icon = "fa-facebook"
          break;
        case "Apple":
          icon = "fa-apple"
          break;
        default:
          break
      }
      var newChannel = {
        name: body.name,
        id: body.id,
        contactId: (body.contactId) ? body.contactId : "",
        channelType: body.channelType,
        icon: icon,
        avatarUri: body.avatarUri
      }
      // Apple https://advanced-messaging-demo-1.digital.ringcentral.com/files/identities/d3a/512/4b3f2e9e9898c095aa58435a35/avatar/apple.jpeg?953a95
      // WhatsApp https://advanced-messaging-demo-1.digital.ringcentral.com/files/identities/acf/ab0/ee458d77da52dcf29b2b861ec2/avatar/427531744_373981938889034_3503577298326220522_n.jpg?0c8da4
      this.connectedChannels.push(newChannel)
      var channelsStr = JSON.stringify(this.connectedChannels)
      var query = "INSERT INTO social_msg_accounts (acct_id, subscription_id, connected_channels)"
      query += " VALUES ($1,$2,$3)"
      var values = [this.accountId, "", channelsStr]
      query += ` ON CONFLICT (acct_id) DO UPDATE SET connected_channels='${channelsStr}'`
      //console.log(query)
      var result = await pgdb.insertAsync(query, values)
      var response = {
        status: "ok",
        message: "New channel added"
      }
      if (!result){
          console.error("Cannot update connected channels");
          response.status = "error"
          response.message = "Cannot register a new channel"
      }else{
          console.log("New channel added. DONE");
      }
      res.send(response)
    },
    unregisterChannel: async function(channelId, res){
      var channelIndex = this.connectedChannels.findIndex(o => o.id === channelId)
      if (channelIndex >= 0){
        this.connectedChannels.splice(channelIndex, 1)
      }
      var channelsStr = JSON.stringify(this.connectedChannels)
      var query = `UPDATE social_msg_accounts SET connected_channels='${channelsStr}' WHERE acct_id='${this.accountId}'`
      //console.log(query)
      var result = await pgdb.updateAsync(query)
      var response = {
        status: "ok",
        message: "Selected channel unregistered"
      }
      if (!result){
          console.error("Cannot update connected channels");
          response.status = "error"
          response.message = "Cannot unregister this channel"
      }else{
          console.log("Channel unregistered. DONE");
      }
      res.send(response)
    },
    readAgentInfo: async function(p){
      try{
        for (var agent of this.agentsList){
          var endpoint = `/restapi/v1.0/account/~/extension/${agent.userId}`
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          agent.name = jsonObj.name
        }
        //console.log(this.agentsList)
      }catch(e){
        console.log(e.message)
      }
    },
    listIdentities: async function(p){
      try{
        let endpoint = "/cx/social-messaging/v1/identities"
        let params = {
          //sourceId: "65c3fdd9527bf900079cefcb",
          //identityGroupId: ""
          //userId: "63317565004"
        }
        var resp = await p.get(endpoint, params)
        var jsonObj = await resp.json()
        //console.log(JSON.stringify(jsonObj))
        for (var record of jsonObj.records){
          var item = {
            id: record.id,
            lastName: record.lastName,
            firstName: record.firstName,
            displayName: record.displayName,
            screenName: record.screenName,
            avatarUri: record.avatarUri,
            identityGroupId: record.identityGroupId,
            mobilePhone: record.mobilePhone,
            userIds: record.userIds
          }
          this.identities.push(item)
          if (record.userIds.length > 0){
            for (var userId of record.userIds){
              var index = this.agentsList.findIndex(a => a.userId == userId)
              if (index < 0){
                var item = {
                  name: "",
                  userId: userId
                }
                this.agentsList.push(item)
              }
            }
          }else{ // Assumed that this is a contact
            if (record.mobilePhone && isNaN(record.mobilePhone))
              continue
            var contact = {
                id: record.id,
                lastName: record.lastName,
                firstName: record.firstName,
                displayName: record.displayName,
                screenName: record.screenName,
                identityGroupId: record.identityGroupId,
                mobilePhone: record.mobilePhone,
                type: record.type
            }
            this.contactsList.push(contact)
          }
        }
        //console.log(this.contactsList)
      }catch(e){
        console.log(e.message)
      }
    },
    initiateFBConversation: async function(req, res){
      var body = req.body
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          let endpoint = `/cx/social-messaging/v1/contents`
          console.log(endpoint)
          var bodyParams = {
              body: body.message,
              autoSubmitted: true,
              public: false,
              sourceId: body.channelId
            }
          console.log(bodyParams)
          var resp = await p.post(endpoint, bodyParams)
          var jsonObj = await resp.json()
          //console.log(jsonObj)
          var identity = this.identities.find( o => o.id == jsonObj.authorIdentityId)
          var agent = this.agentsList.find( o => o.userId == jsonObj.creatorId)
          var message = {
                  id: jsonObj.id,
                  creationTime: jsonObj.creationTime,
                  lastModifiedTime: jsonObj.lastModifiedTime,
                  authorName: (identity != null) ? identity.displayName : "Unknown",
                  authorIdentityId: jsonObj.authorIdentityId,
                  body: jsonObj.body,
                  contentUri: "",
                  avatarUri: (identity != null) ? identity.avatarUri : "",
                  creatorId: jsonObj.creatorId,
                  agentName: (agent) ? agent.name : "",
                  synchronizationStatus: jsonObj.synchronizationStatus,
                  status: jsonObj.status,
                  threadId: jsonObj.threadId,
                  inReplyToContentId: jsonObj.inReplyToContentId,
                  inReplyToAuthorIdentityId: jsonObj.inReplyToAuthorIdentityId,
                  channelId: jsonObj.channelId
                }
          res.send({
              status:"ok",
              message: message
          })
        }catch(e){
          console.log(e.message)
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        console.log("initiateFBConversation() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    initiateWAConversation: async function(req, res){
      var body = req.body
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          let endpoint = `/cx/social-messaging/v1/contents`
          console.log(endpoint)
          var bodyParams = {
              to: [body.to],
              //autoSubmitted: false,
              public: false,
              sourceId: body.channelId,
              templateName: body.templateName,
              templateLanguage: body.templateLanguage,
              components: JSON.parse(body.components)
            }
          var resp = await p.post(endpoint, bodyParams)
          var jsonObj = await resp.json()
          var identity = this.identities.find( o => o.id == jsonObj.authorIdentityId)
          var agent = this.agentsList.find( o => o.userId == jsonObj.creatorId)
          var message = {
                  id: jsonObj.id,
                  creationTime: jsonObj.creationTime,
                  lastModifiedTime: jsonObj.lastModifiedTime,
                  authorName: (identity != null) ? identity.displayName : "Unknown",
                  authorIdentityId: jsonObj.authorIdentityId,
                  body: jsonObj.structuredContent.subtitle,
                  contentUri: "",
                  avatarUri: (identity != null) ? identity.avatarUri : "",
                  creatorId: jsonObj.creatorId,
                  agentName: (agent) ? agent.name : "",
                  synchronizationStatus: jsonObj.synchronizationStatus,
                  status: jsonObj.status,
                  threadId: jsonObj.threadId,
                  inReplyToContentId: jsonObj.inReplyToContentId,
                  inReplyToAuthorIdentityId: jsonObj.inReplyToAuthorIdentityId,
                  channelId: jsonObj.channelId
                }
          res.send({
              status:"ok",
              message: message
          })
        }catch(e){
          console.log(e.message)
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        console.log("initiateWAConversation() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    sendMessage: async function(req, res){
      var body = req.body
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          let endpoint = `/cx/social-messaging/v1/contents`
          var bodyParams = {
              inReplyToContentId: body.to,
              //authorIdentityId: '65c3fe3e729ae3000785aac1',
              body: body.message,

              //templateLanguage: "en",
              autoSubmitted: true,
              public: false,
              //channelType: 'WhatsApp',
              sourceId: body.id
            }
          var resp = await p.post(endpoint, bodyParams)
          var jsonObj = await resp.json()
          //var obj = resp.headers
          //console.log("headers", obj)
          //console.log(jsonObj)
          var identity = this.identities.find( o => o.id == jsonObj.authorIdentityId)
          var agent = this.agentsList.find( o => o.userId == jsonObj.creatorId)
          var message = {
                  id: jsonObj.id,
                  creationTime: jsonObj.creationTime,
                  lastModifiedTime: jsonObj.lastModifiedTime,
                  authorName: (identity != null) ? identity.displayName : "Unknown",
                  authorIdentityId: jsonObj.authorIdentityId,
                  body: jsonObj.body,
                  contentUri: "",
                  avatarUri: (identity != null) ? identity.avatarUri : "",
                  creatorId: jsonObj.creatorId,
                  agentName: (agent) ? agent.name : "",
                  synchronizationStatus: jsonObj.synchronizationStatus,
                  status: jsonObj.status,
                  type: jsonObj.type,
                  threadId: jsonObj.threadId,
                  inReplyToContentId: jsonObj.inReplyToContentId,
                  inReplyToAuthorIdentityId: jsonObj.inReplyToAuthorIdentityId,
                  channelId: jsonObj.channelId
                }
          res.send({
              status:"ok",
              message: message
          })
        }catch(e){
          console.log(e.message)
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        console.log("sendMessage() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    pollNewMessages: function(res){
      res.send({
          status: "ok",
          newMessages: this.newMessages
      })
      this.newMessages = []
    },
    checkSendMessageStatus: async function(msgId, res){
      var endpoint = `/cx/social-messaging/v1/contents/${msgId}`
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          //console.log(jsonObj)
          var identity = this.identities.find( o => o.id == jsonObj.authorIdentityId)
          var agent = this.agentsList.find( o => o.userId == jsonObj.creatorId)
          var message = {
                  id: jsonObj.id,
                  creationTime: jsonObj.creationTime,
                  lastModifiedTime: jsonObj.lastModifiedTime,
                  authorName: (identity != null) ? identity.displayName : "Unknown",
                  authorIdentityId: jsonObj.authorIdentityId,
                  body: jsonObj.body,
                  contentUri: "",
                  avatarUri: (identity != null) ? identity.avatarUri : "",
                  creatorId: jsonObj.creatorId,
                  agentName: (agent) ? agent.name : "",
                  synchronizationStatus: jsonObj.synchronizationStatus,
                  status: jsonObj.status,
                  type: jsonObj.type,
                  threadId: jsonObj.threadId,
                  inReplyToContentId: jsonObj.inReplyToContentId,
                  inReplyToAuthorIdentityId: jsonObj.inReplyToAuthorIdentityId,
                  channelId: jsonObj.channelId
                }
          res.send({
              status:"ok",
              message: message
          })
        } catch (e) {
          console.log("checkSendMessageStatus()")
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    readMessageList: function (req, res){
      console.log("readMessageList")

      var readParams = {
        //view: "Detailed",//req.body.view,
        //dateFrom: req.body.dateFrom,
        //dateTo: req.body.dateTo,
        source: JSON.parse(req.body.channelId),
        perPage: parseInt(req.body.perPage)
      }
      /*
      if (req.body.direction != "Both")
        readParams['direction'] = req.body.direction

      if (req.body.phoneNumbers)
        readParams['phoneNumber'] = JSON.parse(req.body.phoneNumbers)
      */

      if (req.body.pageToken != undefined && req.body.pageToken != "")
          readParams['pageToken'] = req.body.pageToken
      //else
      //  readParams['source'] = JSON.parse(req.body.sourceId)

      //console.log("readParams", readParams)
      this._readMessageList(res, readParams)
    },
    _readMessageList: async function (res, readParams){
      //console.log("_readMessageList")
      var endpoint = "/cx/social-messaging/v1/contents"
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          var conversations = this.processSMResponse(jsonObj)
          var response = {
            status: "ok",
            result: conversations,
            pageTokens: {
              nextPageToken: "",
              previousPageToken: ""
            },
            paging: jsonObj.paging
          }
          //console.log("paging", jsonObj.paging) P@ssw0rd+6592091212
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
              response.pageTokens.nextPageToken = jsonObj.paging.nextPageToken
          }
          if (jsonObj.paging.hasOwnProperty("previousPageToken")){
              response.pageTokens.previousPageToken = jsonObj.paging.previousPageToken
          }
          res.send(response)

        } catch (e) {
          console.log("readParams", readParams)
          console.log("_readMessageList()", e.message)
          var obj = e.response.headers
          console.log(`_readMessageList() Request id: ${obj.get('rcrequestid')}`)
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    processSMResponse: function (jsonObj){
      //console.log(JSON.stringify(jsonObj))
      var conversationGroups = []
      var conversations = []

      for (var record of jsonObj.records){
        var identity = this.identities.find( o => o.id == record.authorIdentityId)

        var agent = this.agentsList.find( o => o.userId == record.creatorId)
        var contentUri = ""
        var body = record.body
        // all possible types:
        /*
         Album, AuthenticateMessage, AuthenticateResponse, Carousel,
         CarouselMessage, Comment, ContactMessage, Content, Email,
         FormMessage, FormResponse, HsmMessage, Link, ListMessage,
         Media, Message, OutboundMessage, PaymentMessage, Photo,
         PostbackMessage, PrivateTweet, PromptMessage, Question, Review,
         ReviewResponse, RichLinkMessage, SelectMessage, Status, TemplateMessage,
         TimePickerMessage, Tweet, Video, VideoCallRequestMessage
        */
        if (record.channelType == "Facebook"){
          if (record.type == "Photo" || record.type == "Album"){
            contentUri = record.fbLink
          }
        }else if (record.channelType == "WhatsApp"){
          if (record.attachments.length > 0){
            //console.log(record)
            for (var attachment of record.attachments){
              if (attachment.contentType == 'image/jpeg'){
                contentUri = attachment.uri
              }
            }
          }
          if (record.type == "OutboundMessage"){
            if (record.hasOwnProperty("structuredContent")){
              body = record.structuredContent.subtitle
            }
          }
        }else if (record.channelType == "AppleMessagesForBusiness"){
          if (record.attachments.length > 0){
            //console.log(record)
            for (var attachment of record.attachments){
              if (attachment.contentType == 'image/jpeg'){
                contentUri = attachment.uri
              }
            }
          }
        }

        var item = {
          id: record.id,
          creationTime: record.creationTime,
          lastModifiedTime: record.lastModifiedTime,
          authorIdentityId: record.authorIdentityId,
          authorName: (identity != null) ? identity.displayName : "Unknown",
          body: body,
          contentUri: contentUri,
          avatarUri: (identity != null) ? identity.avatarUri : "",
          creatorId: record.creatorId,
          agentName: (agent) ? agent.name : "",
          status: record.status,
          type: record.type,
          synchronizationStatus: record.synchronizationStatus,
          threadId: record.threadId,
          inReplyToContentId: record.inReplyToContentId,
          inReplyToAuthorIdentityId: record.inReplyToAuthorIdentityId,
          channelId: record.channelId
        }
        var conversationId = `${record.channelId}-${record.authorIdentityId}`
        var pairedConversationId = `${record.channelId}-${record.inReplyToAuthorIdentityId}`
        if (record.status == "New" || record.status == "Ignored" || record.status == "Replied"){
          // inbound msg
          var group = conversationGroups.find(o => o.conversationId == conversationId /*record.authorIdentityId // record.threadId*/)
          if (group){
            group.conversations.push(item)
          }else{
            var newConvo = {
              conversationStatus: "open",
              newMsgCount: 0,
              conversationId:  conversationId, //record.authorIdentityId, //record.threadId,
              //conversationName: "",
              conversations: [item]
            }
            conversationGroups.push(newConvo)
          }
        }else{ // outbound msg
          var group = conversationGroups.find(o => o.conversationId == pairedConversationId /*record.inReplyToAuthorIdentityId // record.threadId*/)
          if (group){
            group.conversations.push(item)
          }else{
            var newConvo = {
              conversationStatus: "open",
              newMsgCount: 0,
              conversationId: pairedConversationId, // record.inReplyToAuthorIdentityId, //record.threadId,
              //conversationName: "",
              conversations: [item]
            }
            conversationGroups.push(newConvo)
          }
        }


      }
      //console.log(conversationGroups)
      return conversationGroups
    },
    // analytics
    pollAnalyticsResult: function (res){
      console.log("poll analytics")
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
      })
    },
    downloadAnalytics: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = `${dir}Statistics-${req.query.fileName}.csv`
      var fileContent = ""
      // Total
      fileContent = `Messaging statistics ${req.query.fileName}`
      fileContent += "\nTotal messages by direction"
      fileContent += `\n,Outbound,${this.analytics.analyticsData.outboundCount}`
      fileContent += `\n,Inbound,${this.analytics.analyticsData.inboundCount}`
      fileContent += `\n,Total,${this.analytics.analyticsData.outboundCount + this.analytics.analyticsData.inboundCount},`

      fileContent += "\nTotal cost by direction (USD)"
      var totalCost = this.analytics.analyticsData.sentMsgCost + this.analytics.analyticsData.receivedMsgCost
      fileContent += `\n,Outbound,${this.analytics.analyticsData.sentMsgCost.toFixed(2)}`
      fileContent += `\n,Inbound,${this.analytics.analyticsData.receivedMsgCost.toFixed(2)}`
      fileContent += `\n,Total,${totalCost.toFixed(2)},`
      // status
      fileContent += "\nTotal messages by status"
      fileContent += `\n,Delivered,${this.analytics.analyticsData.deliveredCount}`
      fileContent += `\n,Sending failed,${this.analytics.analyticsData.sendingFailedCount}`
      fileContent += `\n,Delivery failed,${this.analytics.analyticsData.deliveryFailedCount}`

      // Monthly
      fileContent += "\n\n# Messages by direction (per month)"

      var monthlyData = this.analytics.analyticsData.months

      var months = "\n,Month"
      var inboundMsg = "\n,# Inbound messages"
      var outboundMsg = "\n,# Outbound messages"
      var totalMsg = "\n,# Total messages"
      var responseRate = "\n,Response rate"

      var statusInfoHeader = "\n# Outbound messages by status (per month)"
      var deliveredMsg = "\n,# Delivered messages"
      var failedMsg = "\n,# Failed messages"
      var deliveryRate = "\n,Delivery rate"

      var costInfoHeader = "\nCost by direction (USD per month)"
      var inboundCost = "\n,Cost of inbound messages"
      var outboundCost = "\n,Cost of outbound messages"
      var totalCost = "\n,Total cost"

      var costEfficiencyHeader = "\nOutbound messaging cost efficiency (USD per month)"
      var deliveredCost = "\n,Cost of succeeded outbound messages"
      var failedCost = "\n,Cost of failed outbound messages"
      var efficiencyRate = "\n,Cost efficiency rate"

      for (var i=monthlyData.length-1; i>=0; i--) {
        var m =  monthlyData[i]
        var total = m.inboundCount + m.outboundCount
        var rate = 0.0
        if (m.outboundCount > 0)
          rate = (m.inboundCount / m.outboundCount) * 100
        months += `,${m.month}`
        inboundMsg += `,${m.inboundCount}`
        outboundMsg += `,${m.outboundCount}`
        totalMsg += `,${total}`
        responseRate += `,${rate.toFixed(2)}%`

        // status
        total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
        if (total > 0)
          rate = (m.deliveredCount / total) * 100
        deliveredMsg += `,${m.deliveredCount}`
        failedMsg += `,${m.deliveryFailedCount + m.sendingFailedCount}`
        deliveryRate += `,${rate.toFixed(2)}%`

        // cost
        var totalOutbountCost = m.deliveredMsgCost + m.failedMsgCost
        total = totalOutbountCost + m.receivedMsgCost
        if (totalOutbountCost > 0.0)
          rate = (m.deliveredMsgCost / totalOutbountCost) * 100
        inboundCost += `,${m.receivedMsgCost.toFixed(2)}`
        outboundCost += `,${totalOutbountCost.toFixed(2)}`
        totalCost += `,${total.toFixed(2)}`

        // cost efficiency
        total = m.deliveredMsgCost + m.failedMsgCost
        if (total > 0.0)
          rate = (m.deliveredMsgCost / total) * 100
        deliveredCost += `,${m.deliveredMsgCost.toFixed(2)}`
        failedCost += `,${m.failedMsgCost.toFixed(2)}`
        efficiencyRate += `,${rate.toFixed(2)}`
      }
      fileContent += `${months}${inboundMsg}${outboundMsg}${totalMsg}${responseRate}`
      fileContent += statusInfoHeader
      fileContent += `${months}${deliveredMsg}${failedMsg}${deliveryRate}`
      fileContent += costInfoHeader
      fileContent += `${months}${inboundCost}${outboundCost}${totalCost}`
      fileContent += costEfficiencyHeader
      fileContent += `${months}${deliveredCost}${failedCost}${efficiencyRate}`

      // per number
      fileContent += "\n\n# Messages by direction (per service number)"

      var serviceNumber = "\n,Service Number"
      inboundMsg = "\n,# Inbound messages"
      outboundMsg = "\n,# Outbound messages"
      totalMsg = "\n,# Total messages"
      responseRate = "\n,Response rate"

      statusInfoHeader = "\n# Outbound messages by status (per service number)"
      deliveredMsg = "\n,# Delivered messages"
      failedMsg = "\n,# Failed messages"
      deliveryRate = "\n,Delivery rate"

      costInfoHeader = "\nCost by direction (USD per service number)"
      inboundCost = "\n,Cost of inbound messages"
      outboundCost = "\n,Cost of outbound messages"
      totalCost = "\n,Total cost"

      costEfficiencyHeader = "\nOutbound messaging cost efficiency (USD per service number)"
      deliveredCost = "\n,Cost of succeeded outbound messages"
      failedCost = "\n,Cost of failed outbound messages"
      efficiencyRate = "\n,Cost efficiency rate"

      var serviceNumberData = this.analytics.analyticsData.phoneNumbers
      for (var i=serviceNumberData.length-1; i>=0; i--) {
        var m =  serviceNumberData[i]

        var total = m.inboundCount + m.outboundCount
        var rate = 0.0
        if (m.outboundCount > 0)
          rate = (m.inboundCount / m.outboundCount) * 100
        serviceNumber += `,${formatPhoneNumber(m.number)}`
        inboundMsg += `,${m.inboundCount}`
        outboundMsg += `,${m.outboundCount}`
        totalMsg += `,${total}`
        responseRate += `,${rate.toFixed(2)}%`

        // status
        total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
        if (total > 0)
          rate = (m.deliveredCount / total) * 100
        deliveredMsg += `,${m.deliveredCount}`
        failedMsg += `,${m.deliveryFailedCount + m.sendingFailedCount}`
        deliveryRate += `,${rate.toFixed(2)}%`

        // cost
        var totalOutbountCost = m.deliveredMsgCost + m.failedMsgCost
        total = totalOutbountCost + m.receivedMsgCost
        if (totalOutbountCost > 0.0)
          rate = (m.deliveredMsgCost / totalOutbountCost) * 100
        inboundCost += `,${m.receivedMsgCost.toFixed(2)}`
        outboundCost += `,${totalOutbountCost.toFixed(2)}`
        totalCost += `,${total.toFixed(2)}`

        // cost efficiency
        total = m.deliveredMsgCost + m.failedMsgCost
        if (total > 0.0)
          rate = (m.deliveredMsgCost / total) * 100
        deliveredCost += `,${m.deliveredMsgCost.toFixed(2)}`
        failedCost += `,${m.failedMsgCost.toFixed(2)}`
        efficiencyRate += `,${rate.toFixed(2)}`
      }

      fileContent += `${serviceNumber}${inboundMsg}${outboundMsg}${totalMsg}${responseRate}`
      fileContent += statusInfoHeader
      fileContent += `${serviceNumber}${deliveredMsg}${failedMsg}${deliveryRate}`
      fileContent += costInfoHeader
      fileContent += `${serviceNumber}${inboundCost}${outboundCost}${totalCost}`
      fileContent += costEfficiencyHeader
      fileContent += `${serviceNumber}${deliveredCost}${failedCost}${efficiencyRate}`

      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        res.send({
          status:"ok",
          message:link
        })
        // delete in 20 secs
        var deleteFile = `./${fullNamePath}`
        setTimeout(function(){
          if (fs.existsSync(deleteFile))
            fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)

      }catch (e){
        console.log("downloadAnalytics() - cannot create report file")
        res.send({
          status:"error",
          message:"Cannot create a report file! Please try gain"
        })
      }
    },
    getMessagingAnalytics: function (req, res){
      console.log("getMessagingAnalytics")
      this.analytics.resetAnalyticsData()
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
      })
      var queryParams = {
        perPage: 50
      }
      console.log(req.body)
      if (req.body.fromChannels != 'all'){
        queryParams['source'] = [req.body.fromChannels]
      }
      console.log(queryParams)
      this._readMessageStoreForAnalytics(queryParams)
    },
    _readMessageStoreForAnalytics: async function(queryParams){
      console.log("_readMessageStoreForAnalytics")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      this.analytics.analyticsData.task = "Processing"
      if (p){
        try {
          let endpoint = "/cx/social-messaging/v1/contents"
          let params = {
              perPage: 50
          }
          /*
          if (pageToken != ""){
            queryParams['pageToken'] = pageToken
          }
          */
          var resp = await p.get(endpoint, queryParams)
          var jsonObj = await resp.json()
          //console.log(JSON.stringify(jsonObj))

          for (var record of jsonObj.records){
            //console.log(record)
            this.analytics.analyzeMessage(record)
          }

          if (jsonObj.paging.hasOwnProperty('nextPageToken')) {
          //if (jsonObj.paging.nextPageToken != "") {
            queryParams['pageToken'] = jsonObj.paging.nextPageToken
            // Make sure not to exceed the API rate limit of 40 API calls per minute
            await sleep(1200)
            console.log("Read content from the next page ...")
            this._readMessageStoreForAnalytics(queryParams)
          }else{
            console.log("Done! No more next page.")
            console.log("done analytics")
            this.analytics.analyticsData.task = "Completed"
            /*
            console.log(this.analytics.analyticsData)
            */
            /*
            console.log("By channel")
            for (var channel of this.analytics.analyticsData.channels){
              console.log(channel.channelName)
              console.log("customer new messages:", channel.customerNewMsgIds.length)
              console.log("customer replied messages:", channel.customerRepliedMsgIds.length)
              console.log("Agent's new messages:", channel.agentNewMsgIds.length)
              console.log("Agent's replied messages:", channel.agentRepliedMsgIds.length)
              console.log("=====")
            }
            console.log("By month")
            for (var month of this.analytics.analyticsData.months){
              console.log(month.month)
              console.log("customer new messages:", month.customerNewMsgIds.length)
              console.log("customer replied messages:", month.customerRepliedMsgIds.length)
              console.log("Agent's new messages:", month.agentNewMsgIds.length)
              console.log("Agent's replied messages:", month.agentRepliedMsgIds.length)
              console.log("=====")
            }
            */
          }
        } catch (e) {
          console.log("_readMessageStoreForAnalytics() failed", e.message)
          this.analytics.analyticsData.task = "Interrupted"
        }
      }else{
        this.analytics.analyticsData.task = "Interrupted"
        console.log("_readMessageStoreForAnalytics() - Platform error")
      }
    },
    // analytics end
    _createReportFile: async function(query, pageToken){
      console.log("_createReportFile")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: query.batchId,
        perPage: 1000
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          var appendFile = (pageToken == "") ? false : true
          var link = this.writeToFile(query, jsonObj.records, appendFile)

          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("Read next page")
            var thisUser = this
            setTimeout(function(){
              thisUser._createReportFile(query, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            console.log("No next page => create report done")
            this.downloadLink = link
            this.createReportStatus = 'done'
            //callback(null, link)
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          this.createReportStatus = 'error'
        }
      }else{
        console.log("create report failed")
        this.createReportStatus = 'failed'
      }
    },
    writeToFile: function(query, records, appendFile){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var name = decodeURIComponent(query.campaignName).replace(/#/g, "")
      name = name.replace(/[\/\s]/g, "-")
      var fullNamePath = dir + name
      console.log(`fullNamePath ${fullNamePath}`)
      var fileContent = ""
      fullNamePath += '-campaign-report.csv'
      if (appendFile == false)
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Error Code,Error Description,Cost,Segment"
      var timeOffset = parseInt(query.timeOffset)
      let dateOptions = { weekday: 'short' }
      for (var item of records){
        //console.log(item)
        var from = formatPhoneNumber(item.from)
        var to = formatPhoneNumber(item.to[0])
        var date = new Date(item.creationTime)
        var timestamp = date.getTime() - timeOffset
        var createdDate = new Date (timestamp)
        var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
        createdDateStr += " " + createdDate.toLocaleDateString("en-US")
        createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
        date = new Date(item.lastModifiedTime)
        var timestamp = date.getTime() - timeOffset
        var updatedDate = new Date (timestamp)
        var updatedDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
        updatedDateStr += " " + createdDate.toLocaleDateString("en-US")
        updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
        var errorCode = ""
        var errorDes = ""
        if (item.hasOwnProperty('errorCode')){
          errorCode = item.errorCode
          errorDes = getErrorDescription(errorCode)
        }
        var cost = (item.cost) ? item.cost : 0.00
        var segmentCount = (item.segmentCount) ? item.segmentCount : 0
        fileContent += `\n${item.id},${from},${to},${createdDateStr},${updatedDateStr}`
        fileContent +=  `,${item.messageStatus},${errorCode},"${errorDes}",${cost},${segmentCount}`
      }
      try{
        if (appendFile == false){
          fs.writeFileSync('./'+ fullNamePath, fileContent)
        }else{
          fs.appendFileSync('./'+ fullNamePath, fileContent)
        }
      }catch(e){
          console.log("cannot create report file")
      }
      return "/downloads?filename=" + fullNamePath
    },
    downloadStandardSMSReport: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '.json'
        fileContent = JSON.stringify(this.detailedReport)
      }else if (req.query.format == "CSV"){
        fullNamePath += '.csv'
        fileContent = "id,uri,creationTime,fromNumber,status,smsSendingAttemptsCount,toNumber"
        for (var item of this.detailedReport){
          fileContent += "\n"
          fileContent += item.id + "," + item.uri + "," + item.creationTime + "," + item.from + "," + item.status + "," + item.smsSendingAttemptsCount + "," + item.to
        }
      }else{
        fullNamePath += '_BatchReport.json'
        var fileContent = JSON.stringify(this.batchFullReport)
      }
      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        res.send({
          status:"ok",
          message:link
        })
        var deleteFile = `./${fullNamePath}`
        setTimeout(function(){
          if(fs.existsSync(deleteFile))
            fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)

      }catch (e){
        console.log("cannot create report file")
        res.send({
          status: "error",
          message: "Cannot create a report file! Please try gain"
        })
      }
    },
    logout: async function(callback){
      console.log("LOGOUT FUNC")
      // delete subscription
      //await this.deleteSubscription()
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p)
          await p.logout()
      else
          console.log("No platform?")
      this.subscriptionId = ""
      callback(null, 1)
    },
    _readNotifiedMessage: async function(contentId){
      //console.log("_readNotifiedMessage")
      var endpoint = `/cx/social-messaging/v1/contents/${contentId}`
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          var identity = this.identities.find( o => o.id == jsonObj.authorIdentityId)
          var agent = this.agentsList.find( o => o.userId == jsonObj.creatorId)
          var contentUri = ""
          var body = jsonObj.body
          if (jsonObj.channelType == "Facebook"){
            if (jsonObj.type == "Photo" || jsonObj.type == "Album"){
              contentUri = jsonObj.fbLink
            }
          }else if (jsonObj.channelType == "WhatsApp"){
            if (jsonObj.hasOwnProperty('attachments') && jsonObj.attachments.length > 0){
              for (var attachment of jsonObj.attachments){
                if (attachment.contentType == 'image/jpeg'){
                  contentUri = attachment.uri
                }
              }
            }
            if (jsonObj.type == "OutboundMessage"){
              if (jsonObj.hasOwnProperty("structuredContent")){
                body = jsonObj.structuredContent.subtitle
              }
            }
          }else if (jsonObj.channelType == "AppleMessagesForBusiness"){
            if (jsonObj.attachments.length > 0){
              for (var attachment of jsonObj.attachments){
                if (attachment.contentType == 'image/jpeg'){
                  contentUri = attachment.uri
                }
              }
            }
          }
          //console.log(jsonObj)
          var message = {
                  id: jsonObj.id,
                  creationTime: jsonObj.creationTime,
                  lastModifiedTime: jsonObj.lastModifiedTime,
                  authorName: (identity != null) ? identity.displayName : "Unknown",
                  authorIdentityId: jsonObj.authorIdentityId,
                  body: body,
                  contentUri: contentUri,
                  avatarUri: (identity != null) ? identity.avatarUri : "",
                  creatorId: jsonObj.creatorId,
                  agentName: (agent) ? agent.name : "",
                  synchronizationStatus: jsonObj.synchronizationStatus,
                  status: jsonObj.status,
                  type: jsonObj.type,
                  threadId: jsonObj.threadId,
                  inReplyToContentId: jsonObj.inReplyToContentId,
                  inReplyToAuthorIdentityId: jsonObj.inReplyToAuthorIdentityId,
                  channelId: jsonObj.channelId
                }
          this.newMessages.unshift(message)
        } catch (e) {
          console.log("Cannot read notified message.")
        }
      }else{
        console.log("You have been logged out. Please login again.")
      }
    },
    processEventNotication: function(eventPayload){
      // Workaround solution
      //console.log("notification payload", eventPayload.body)
      var contentId = eventPayload.body.resource.id
      this._readNotifiedMessage(contentId)
      return
      // The following code can be used only after the notifucation payload is sufficient
      //console.log(eventPayload)
      var body = eventPayload.body.resource
      var synchronizationStatus = "Success"
      /*
      if (eventPayload.event == '/cx/social-messaging/v1/contents/Imported'){
        synchronizationStatus
      }else if (eventPayload.event == '/cx/social-messaging/v1/contents/Exported'){
        synchronizationStatus
      }
      */
      var identity = this.identities.find( o => o.id == body.authorIdentityId)

      var agent = this.agentsList.find( o => o.userId == body.creatorId)
      var contentUri = ""
      // all possible types:
      /*
       Album, AuthenticateMessage, AuthenticateResponse, Carousel,
       CarouselMessage, Comment, ContactMessage, Content, Email,
       FormMessage, FormResponse, HsmMessage, Link, ListMessage,
       Media, Message, OutboundMessage, PaymentMessage, Photo,
       PostbackMessage, PrivateTweet, PromptMessage, Question, Review,
       ReviewResponse, RichLinkMessage, SelectMessage, Status, TemplateMessage,
       TimePickerMessage, Tweet, Video, VideoCallRequestMessage
      */
      if (body.channelType == "Facebook"){
        if (body.type == "Photo" || body.type == "Album"){
          contentUri = body.fbLink
        }
      }else if (body.channelType == "WhatsApp"){
        if (body.hasAttachment) {
          if (body.hasOwnProperty('attachments') && body.attachments.length > 0){
            for (var attachment of body.attachments){
              if (attachment.contentType == 'image/jpeg'){
                contentUri = attachment.uri
              }
            }
          }
        }
      }
      var synchronizationStatus = "Success"
      var message = {
        id: body.id,
        creationTime:  eventPayload.body.issuedAt,//body.creationTime,
        lastModifiedTime: body.lastModifiedTime,
        authorIdentityId: body.authorIdentityId,
        authorName: (identity != null) ? identity.displayName : "Unknown",
        body: body.body,
        contentUri: contentUri,
        avatarUri: (identity != null) ? identity.avatarUri : "",
        creatorId: body.creatorId,
        agentName: (agent) ? agent.name : "",
        status: body.status,
        type: body.type,
        synchronizationStatus: synchronizationStatus, //body.synchronizationStatus,
        threadId: body.threadId,
        inReplyToContentId: body.inReplyToContentId,
        inReplyToAuthorIdentityId: body.inReplyToAuthorIdentityId,
        channelId: body.channelId
      }
      this.newMessages.unshift(message)
    },
    // Notifications
    subscribeForNotification: async function(){
      console.log("subscribeForNotification")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = '/restapi/v1.0/subscription'
        var eventFilters = [
          '/cx/social-messaging/v1/contents/Imported',
          '/cx/social-messaging/v1/contents/Exported',
          '/cx/social-messaging/v1/contents/DiscussionInitiated'
        ]

        try {
          var resp = await p.post('/restapi/v1.0/subscription', {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.WEBHOOK_DELIVERY_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          console.log("Ready to receive telephonyStatus notification via WebHook.")
          this.subscriptionId = jsonObj.id
          console.log("Subscription created")
          console.log(this.subscriptionId)
          await this.updateSubscriptionId()
          //fs.writeFileSync("subscriptionid.txt", this.subscriptionId)
        } catch (e) {
          console.log(e.message)
        }
      }else{
        console.log("failed")
      }
    },
    renewSubscription: async function(p){
      //var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = `/restapi/v1.0/subscription/${this.subscriptionId}`
        console.log("Endpoint", endpoint)
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          if (jsonObj.status != "Active"){
            console.log("RENEW subscription")
            try {
              var renewResp = await p.post(`/restapi/v1.0/subscription/${this.subscriptionId}/renew`)
              var jsonObjRenew = renewResp.json()
              console.log("Update notification via WebHook.")
              return
            } catch(e){
              console.log(e.message)
            }
          }else{
            console.log("still active => use it")
            return
          }
        } catch (e) {
          console.log(e.message)
        }

        this.subscribeForNotification()
      }else{
        console.log("err: renewSubscription");
        callback("err", "failed")
      }
    },
    deleteSubscription: async function() {
      console.log("deleteSubscription")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var r =  await p.delete(`/restapi/v1.0/subscription/${this.subscriptionId}`)
          console.log("Deleted subscription")
          await this.updateSubscriptionId()
        }catch(e){
          console.log("Cannot delete notification subscription")
          console.log(e.message)
        }
      }
    },
    /// Clean up WebHook subscriptions
    deleteAllRegisteredWebHookSubscriptions: async function() {
      console.log("deleteAllRegisteredWebHookSubscriptions")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var resp = await p.get('/restapi/v1.0/subscription')
          var jsonObj = await resp.json()
          if (jsonObj.records.length > 0){
            for (var record of jsonObj.records) {
              console.log(JSON.stringify(record))

              if (record.deliveryMode.transportType == "WebHook"){
              //if (record.id != "3e738712-3de9-41ec-bd56-36426d52a98d"){
                var r =  await p.delete(`/restapi/v1.0/subscription/${record.id}`)
                  console.log("Deleted")
              }
            }
            console.log("Deleted all")
          }else{
            console.log("No subscription to delete")
          }
        }catch(e){
          console.log("Cannot delete notification subscription")
          console.log(e.message)
        }
      }else{
        console.log("Cannot get platform => Delete all subscriptions error")
      }
    },
    postFeedbackToGlip: function(req){
      post_message_to_group(req.body, this.mainCompanyNumber, this.accountId, this.userEmail)
    },
    sendInviteToSupportTeam: async function(req, res){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var userInvite = [ req.body.userInvite || '' ];
          var userList = [userInvite]
          //userList.push();
          var resp = await p.post('/restapi/v1.0/glip/groups/' + process.env.SUPPORT_TEAM_ID + '/bulk-assign',{
                        "addedPersonEmails": userInvite
          })
          var jsonObj = await resp.json()
          console.log('The response is :', jsonObj);
          console.log('The total number of users invited to the group is :'+ userList.length);
          console.log('The total number of users registered in the group is :'+jsonObj.members.length);
          console.log("The type of data is :" + typeof userList.length);
          res.send(userList.length.toString());
        }
        catch(e) {
          console.log('INVITE USER DID NOT WORK');
          console.log(e);
          res.send({status: "error", message: "Cannot join group"});
        }
      }else{
        console.log("need login")
        res.send({status: "failed", message: "Not login"});
      }
    },
    getAnswer: async function(message, res){
      var question = `Provide the best short answer to the text between the triple dashes ---${message}---`
      var endpoint = '/v1/chat/completions'
      var bodyParams =
      {
        model: "gpt-4",
        messages: [
          {
            "role": "user",
            "content": question
          }
        ]
      }
      try{
        var response = await this.gpt.post(endpoint, bodyParams)
        //console.log(response)
        var jsonObj = JSON.parse(response)

        //console.log(jsonObj.choices[0].message.content)
        var response = {
          status: "ok",
          message: jsonObj.choices[0].message.content
        }
        res.send(response)
      }catch(e){
        console.log("ChatGPT error", e)
        var response = {
          status: "error",
          message: e
        }
        res.send(response)
      }
    }
}
module.exports = User;


function formatSendingTime(processingTime){
  var hour = Math.floor(processingTime / 3600)
  hour = (hour < 10) ? "0"+hour : hour
  var mins = Math.floor((processingTime % 3600) / 60)
  mins = (mins < 10) ? "0"+mins : mins
  var secs = Math.floor(((processingTime % 3600) % 60))
  secs = (secs < 10) ? "0"+secs : secs
  return `${hour}:${mins}:${secs}`
}

function formatEstimatedTimeLeft(timeInSeconds){
  var duration = ""
  if (timeInSeconds > 3600){
    var h = Math.floor(timeInSeconds / 3600)
    timeInSeconds = timeInSeconds % 3600
    var m = Math.floor(timeInSeconds / 60)
    m = (m>9) ? m : ("0" + m)
    timeInSeconds = Math.floor(timeInSeconds % 60)
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return h + ":" + m + ":" + s
  }else if (timeInSeconds > 60){
    var m = Math.floor(timeInSeconds / 60)
    timeInSeconds = Math.floor(timeInSeconds %= 60)
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return m + ":" + s
  }else{
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return "0:" + s
  }
}

function formatPhoneNumber(phoneNumberString) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '')
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '')
    return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  }
  return phoneNumberString
}

function post_message_to_group(params, mainCompanyNumber, accountId, userEmail){
  var https = require('https');
  var message = params.message + "\n\nUser main company number: " + mainCompanyNumber
  message += "\nUser account Id: " + accountId
  message += "\nUser contact email: " + userEmail
  message += "\nSalesforce lookup: https://rc.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str=" + accountId
  message += "\nAI admin lookup: https://admin.ringcentral.com/userinfo/csaccount.asp?user=XPDBID++++++++++" + accountId + "User"
  var body = {
    "icon": "http://www.qcalendar.com/icons/" + params.emotion + ".png",
    "activity": params.user_name,
    "title": "SMS Toll-Free app user feedback - " + params.type,
    "body": message
  }
  var post_options = {
      host: "hooks.glip.com",
      path: `/webhook/${process.env.INBOUND_WEBHOOK}`,
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      }
  }
  var post_req = https.request(post_options, function(res) {
      var response = ""
      res.on('data', function (chunk) {
          response += chunk
      });
      res.on("end", function(){
        console.log(response)
      });
  });

  post_req.write(JSON.stringify(body));
  post_req.end();
}


function makeId() {
  var text = "";
  var possible = "-~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 1; i < 65; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


function sortRoundTheClock(a,b) {
  return a.hour - b.hour;
}

function sortSegmentCount(a,b) {
  return a.count - b.count;
}

function sortbByNumber(a,b) {
  return a.number - b.number;
}

const sleep = async (ms) => {
  await new Promise(r => setTimeout(r, ms));
}
