//const pgdb = require('./db')
const keyword_extractor = require("keyword-extractor");

function Analytics(connectedChannels, agentsList){
  this.analyticsData = undefined
  this.connectedChannels = connectedChannels
  this.agentsList = agentsList
}

var engine = Analytics.prototype = {
    resetAnalyticsData: function(){
      this.analyticsData = {
        task: "Initiated",
        outboundCount: 0,
        inboundCount: 0,
        deliveredCount: 0,
        sendingFailedCount: 0,
        months: [],
        channels: []
      }
    },

    analyzeMessage: function(message){
      //console.log("check:", message.synchronizationStatus, " / ", message.sourceType)
      // by month
      var localDate = message.creationTime.substring(0, 7)
      var month = this.analyticsData.months.find( o => o.month == localDate)
      if (!month){
        var item = {
          month: localDate,
          outboundCount: 0,
          inboundCount: 0,
          deliveredCount: 0,
          sendingFailedCount: 0,
          customerNewMsgIds: [],
          customerRepliedMsgIds: [],
          agentNewMsgIds: [],
          agentRepliedMsgIds: []
        }
        if (message.status == "UserReply" || message.status == "UserInitiated" || message.status == "PendingApproval"){
          item.outboundCount++
          this.analyticsData.outboundCount++
          switch (message.synchronizationStatus) {
            case "Success":
              item.deliveredCount++
              this.analyticsData.deliveredCount++
              break
            default:
              item.sendingFailedCount++
              this.analyticsData.sendingFailedCount++
              break
          }
          if (message.inReplyToContentId)
            item.agentRepliedMsgIds.push(message.id)
          else
            item.agentNewMsgIds.push(message.id)
        }else{ // received messages
          item.inboundCount++
          this.analyticsData.inboundCount++
          if (!message.inReplyToContentId)
            item.customerNewMsgIds.push(message.id)
          else{
            item.customerRepliedMsgIds.push(message.id)
            console.log("Why customer message has inReplyToContentId?", message)
          }
        }
        this.analyticsData.months.push(item)
      }else{
        if (message.status == "UserReply" || message.status == "UserInitiated" || message.status == "PendingApproval"){ // Outbound
          month.outboundCount++
          this.analyticsData.outboundCount++
          switch (message.synchronizationStatus) {
            case "Success":
              month.deliveredCount++
              this.analyticsData.deliveredCount++
              break
            default:
              month.sendingFailedCount++
              this.analyticsData.sendingFailedCount++
              break
          }
          if (message.inReplyToContentId)
            month.agentRepliedMsgIds.push(message.id)
          else
            month.agentNewMsgIds.push(message.id)
        }else{ // received messages
          month.inboundCount++
          this.analyticsData.inboundCount++
          if (!message.inReplyToContentId)
            month.customerNewMsgIds.push(message.id)
          else{
            month.customerRepliedMsgIds.push(message.id)
            console.log("Why customer message has inReplyToContentId?", message)
          }
        }
      }
      // by channel
      var channel = this.analyticsData.channels.find( o => o.channelId == message.channelId)
      if (!channel){
        var connectedChannel = this.connectedChannels.find( o => o.id == message.channelId)
        var item = {
          channelId: message.channelId,
          channelName: (connectedChannel) ? connectedChannel.name : message.channelId,
          outboundCount: 0,
          inboundCount: 0,
          deliveredCount: 0,
          sendingFailedCount: 0,
          customerNewMsgIds: [],
          customerRepliedMsgIds: [],
          agentNewMsgIds: [],
          agentRepliedMsgIds: []
        }
        if (message.status == "UserReply" || message.status == "UserInitiated" || message.status == "PendingApproval"){
          item.outboundCount++
          switch (message.synchronizationStatus) {
            case "Success":
              item.deliveredCount++
              break
            default:
              item.sendingFailedCount++
              break
          }
          if (message.inReplyToContentId)
            item.agentRepliedMsgIds.push(message.id)
          else
            item.agentNewMsgIds.push(message.id)
        }else{ // received messages
          item.inboundCount++
          if (!message.inReplyToContentId)
            item.customerNewMsgIds.push(message.id)
          else{
            item.customerRepliedMsgIds.push(message.id)
            console.log("Why customer message has inReplyToContentId?")
          }
        }
        this.analyticsData.channels.push(item)
        //console.log(this.analyticsData.phoneNumbers)
      }else{
        if (message.status == "UserReply" || message.status == "UserInitiated" || message.status == "PendingApproval"){
          channel.outboundCount++
          switch (message.synchronizationStatus) {
            case "Success":
              channel.deliveredCount++
              break
            default:
              channel.sendingFailedCount++
              break
          }
          if (message.inReplyToContentId)
            channel.agentRepliedMsgIds.push(message.id)
          else
            channel.agentNewMsgIds.push(message.id)
        }else{ // received messages
          channel.inboundCount++
          if (!message.inReplyToContentId)
            channel.customerNewMsgIds.push(message.id)
          else{
            channel.customerRepliedMsgIds.push(message.id)
            console.log("Why customer message has inReplyToContentId?", message)
          }
        }
      }
      // breakout ends
    },
    extractKeywords: function(message, code){
      var keywords = keyword_extractor.extract(message.text, {
          language:"english",
          remove_digits: false,
          return_changed_case: false,
          remove_duplicates: true
      });
      //var code = (message.errorCode != undefined) ? message.errorCode : "Others"
      var matchedCount = 0
      for (var item of this.analyticsData.failureAnalysis.contents){
        for (var kw of keywords){
          if (item.keywords.findIndex(o => o == kw) >= 0)
            matchedCount++
        }
        //if ((matchedCount > 0) && (matchedCount >= (item.keywords.length-2))){
        //var delta = Math.abs(keywords.length - matchedCount)
        if ((matchedCount > 0) && (matchedCount >= (keywords.length-2))){
          var toNumber = message.to[0]
          if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
            item.acceptedMsgCount++
            var nonspam = item.nonspams.find(n => n.senderNumber === message.from)
            if (nonspam){
              nonspam.count++
              if (nonspam.recipientNumbers.findIndex(n => n === toNumber) < 0){
                nonspam.recipientNumbers.push(toNumber)
              }
            }else{
              var obj = {
                count: 1,
                senderNumber: message.from,
                recipientNumbers: [toNumber]
              }
              item.nonspams.push(obj)
            }
          }else{
            if (code == "SMS-RC-430" || code == "SMS-UP-430" || code == "SMS-CAR-430"){ // item content
              item.spamMsgCount++
              item.ignore = false
              var spam = item.spams.find(n => n.senderNumber === message.from)
              if (spam){
                spam.count++
                if (spam.recipientNumbers.findIndex(n => n === toNumber) < 0){
                  spam.recipientNumbers.push(toNumber)
                }
              }else{
                var obj = {
                  count: 1,
                  senderNumber: message.from,
                  recipientNumbers: [toNumber]
                }
                item.spams.push(obj)
              }
            }else if (code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
              item.rejectedMsgCount++
              if (item.rejectedMsgNumbers.findIndex(n => n === toNumber) < 0)
                item.rejectedMsgNumbers.push(toNumber)
              if (item.rejectedMsgErrorCodes.findIndex(c => c === code) < 0)
                item.rejectedMsgErrorCodes.push(code)
              item.ignore = false
              /*
              item.invalidMsgCount++
              item.ignore = false
              var invalid = item.invalids.find(n => n.senderNumber === message.from)
              if (spam){
                spam.count++
                if (spam.recipientNumbers.findIndex(n => n === toNumber) < 0){
                  spam.recipientNumbers.push(toNumber)
                }
              }else{
                var obj = {
                  count: 1,
                  senderNumber: message.from,
                  recipientNumbers: [toNumber]
                }
                item.invalids.push(obj)
              }
              */
            }
          }
          return
        }
        matchedCount = 0
      }
      if (keywords.length > 0){
        var item = {
            ignore: false,
            message: message.text,
            keywords: keywords,
            acceptedMsgCount: 0,
            nonspams: [],
            spamMsgCount: 0,
            spams: [],
            //invalidMsgCount: 0,
            //invalids: [],
            rejectedMsgCount: 0, // SMS-CAR-432, SMS-CAR-433: rejected message issue
            rejectedMsgNumbers: [],
            rejectedMsgErrorCodes: []
          }

        var toNumber = message.to[0]
        if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
          item.acceptedMsgCount++
          //item.acceptedMsgNumbers.push(toNumber)
          var obj = {
              count: 1,
              senderNumber: message.from,
              recipientNumbers: [toNumber]
          }
          item.nonspams.push(obj)
          item.ignore = true
        }else{
          if (code == "SMS-RC-430" || code == "SMS-UP-430" || code == "SMS-CAR-430"){ // spam message
            item.spamMsgCount++
            var obj = {
                count: 1,
                senderNumber: message.from,
                recipientNumbers: [toNumber]
            }
            item.spams.push(obj)
          }else if (code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // rejected problem
            item.rejectedMsgCount++
            item.rejectedMsgNumbers.push(toNumber)
            item.rejectedMsgErrorCodes.push(code)
            /*
            item.invalidMsgCount++
            //item.spamMsgNumbers.push(toNumber)
            var obj = {
                count: 1,
                senderNumber: message.from,
                recipientNumbers: [toNumber]
            }
            item.invalids.push(obj)
            */
          }
        }
        this.analyticsData.failureAnalysis.contents.push(item)
      }
    }
};

module.exports = Analytics;

function detectPhoneNumber(message){
  var wordArr = message.split(" ")
  var contactNumber = ""
  for (var w of wordArr){
    var number = w.replace(/[+()\-\s]/g, '')
    if (!isNaN(number)){
      if (number.length >= 10 && number.length <= 11){
        contactNumber = w.trim()
        console.log(w)
        break
      }
    }
  }
  return contactNumber
}

const spamContentCodes = ["SMS-UP-430","SMS-CAR-430","SMS-RC-430"] // used to have these ,"SMS-CAR-432","SMS-CAR-433"
const invalidNumberCodes = ["SMS-UP-420","SMS-CAR-411","SMS-CAR-412","SMS-UP-410","SMS-RC-410"]
const optoutNumberCodes = ["SMS-CAR-413","SMS-RC-413"]
const blockedNumberCodes = ["SMS-UP-431"]
function failureAnalysis(message){
  var code = (message.errorCode != undefined) ? message.errorCode : "Others"
  var toNumber = message.to[0]
  if (spamContentCodes.findIndex(c => c === code) >= 0){
    this.analyticsData.outboundFailureTypes.content.count++
    if (this.analyticsData.outboundFailureTypes.content.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.content.numbers.push(toNumber)
    var url = detectShortenUrl(message.text)
    if (url != ""){
      console.log("URL: " + url)
      if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(link => link === url) < 0)
        this.analyticsData.outboundFailureTypes.content.messages.push(url)
    }else{
      var contactNumber = detectPhoneNumber(message.text)
      if (contactNumber != ""){
        if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(number => number === contactNumber) < 0)
          this.analyticsData.outboundFailureTypes.content.messages.push(contactNumber)
      }else
        this.analyticsData.outboundFailureTypes.content.messages.push(message.text)
    }
  }else if (invalidNumberCodes.findIndex(c => c === code) >= 0){
    // recipient number problem
    if (this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.push(toNumber)
  }else if (optoutNumberCodes[0] == code){
    // opted out
    if (this.analyticsData.outboundFailureTypes.optoutNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.optoutNumbers.push(toNumber)
  }else if (blockedNumberCodes[0] == code){
    if (this.analyticsData.outboundFailureTypes.blockedSenderNumbers.findIndex(number => number === message.from) < 0)
      this.analyticsData.outboundFailureTypes.blockedSenderNumbers.push(message.from)
  }else{
    this.analyticsData.outboundFailureTypes.others.count++
    if (this.analyticsData.outboundFailureTypes.others.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.others.numbers.push(toNumber)
    this.analyticsData.outboundFailureTypes.others.messages.push(message.text)
  }
}

function detectUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = msg.substr(index, endIndex)
      console.log(message)
      break
    }
  }
  return unsafeLink
}

function detectShortenUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://bit.ly/",
    "https://ow.ly",
    "https://goo.gl/",
    "https://tinyurl.com/",
    "https://tiny.cc/",
    "https://bc.vc/",
    "https://budurl.com/",
    "https://clicky.me/",
    "https://is.gd/",
    "https://lc.chat/",
    "https://soo.gd/",
    "https://s2r.co/",
    "http://bit.ly/",
    "http://ow.ly",
    "http://goo.gl/",
    "http://tinyurl.com/",
    "http://tiny.cc/",
    "http://bc.vc/",
    "http://budurl.com/",
    "http://clicky.me/",
    "http://is.gd/",
    "http://lc.chat/",
    "http://soo.gd/",
    "http://s2r.co/",
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = message.substr(index, endIndex)
      break
    }
  }
  return unsafeLink
}

function detectSegment(message){
  var segmented = (message.length > 160) ? 1 : 0
  return segmented
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

/*
// by weekDays
found = false
// "creationTime":"2021-05-24T13:49:41.441964Z",
var createdDate = new Date(message.creationTime)
let dateOptions = { weekday: 'short' }
var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
//  createdDateStr += " " + createdDate.toLocaleDateString("en-US")
var wd = createdDateStr.substring(0, 3)
for (var i=0; i<this.analyticsData.weekDays.length; i++){
  var week = this.analyticsData.weekDays[i]
  if (week.wd == wd){
    if (message.direction == "Outbound"){
      this.analyticsData.weekDays[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.weekDays[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.weekDays[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.weekDays[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.weekDays[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.weekDays[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.weekDays[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    wd: wd,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.weekDays.push(item)
  //console.log(this.analyticsData.weekDays)
}
// by roundTheClock
found = false
// "creationTime":"2021-05-24T13:49:41.441964Z",
var hr = message.creationTime.substring(11, 13)
var hour = parseInt(hr)
for (var i=0; i<this.analyticsData.roundTheClock.length; i++){
  var timeSlide = this.analyticsData.roundTheClock[i]
  if (timeSlide.hour == hour){
    if (message.direction == "Outbound"){
      this.analyticsData.roundTheClock[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.roundTheClock[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.roundTheClock[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.roundTheClock[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.roundTheClock[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.roundTheClock[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.roundTheClock[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    hour: hour,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.roundTheClock.push(item)
  //console.log(this.analyticsData.roundTheClock)
}
// by segmentCount
found = false
var segment = (message.segmentCount != undefined) ? parseInt(message.segmentCount) : 0
for (var i=0; i<this.analyticsData.segmentCounts.length; i++){
  var seg = this.analyticsData.segmentCounts[i]
  if (seg.count == segment){
    if (message.direction == "Outbound"){
      this.analyticsData.segmentCounts[i].outboundCount++
      switch (message.messageStatus) {
        case "Delivered":
        case "Sent":
          this.analyticsData.segmentCounts[i].deliveredCount++
          break
        case "DeliveryFailed":
          this.analyticsData.segmentCounts[i].deliveryFailedCount++
          break
        case "SendingFailed":
          this.analyticsData.segmentCounts[i].sendingFailedCount++
          break;
        default:
          break
      }
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.segmentCounts[i].sentMsgCost += cost
    }else{ // received messages
      this.analyticsData.segmentCounts[i].inboundCount++
      var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
      this.analyticsData.segmentCounts[i].receivedMsgCost += cost
    }
    found = true
    break
  }
}
if (!found){
  var item = {
    count: segment,
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0,
  }
  if (message.direction == "Outbound"){
    item.outboundCount++
    switch (message.messageStatus) {
      case "Delivered":
      case "Sent":
        item.deliveredCount++
        break
      case "DeliveryFailed":
        item.deliveryFailedCount++
        break
      case "SendingFailed":
        item.sendingFailedCount++
        break;
      default:
        break
    }
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.sentMsgCost += cost
  }else{ // received messages
    item.inboundCount++
    var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
    item.receivedMsgCost += cost
  }
  this.analyticsData.segmentCounts.push(item)
  //console.log(this.analyticsData.segmentCounts)
}

extractKeywords_old: function(message){
  var keywords = keyword_extractor.extract(message.text, {
      language:"english",
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: false

  });
  //console.log(keywords)
  //console.log("---")
  var code = (message.errorCode != undefined) ? message.errorCode : "Others"
  var matchedCount = 0
  for (var spam of this.analyticsData.failureAnalysis.contents){
    for (var kw of keywords){
      if (spam.keywords.findIndex(o => o == kw) >= 0)
        matchedCount++
    }
    if ((matchedCount > 0) && (matchedCount >= (spam.keywords.length-2))){
      //console.log("matchedCount " + matchedCount)
      //console.log("matched")
      var toNumber = message.to[0]
      if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
        spam.acceptedCount++
        if (spam.acceptedNumbers.findIndex(n => n === toNumber) < 0)
          spam.acceptedNumbers.push(toNumber)
      }else{
        if (code == "SMS-UP-430" || code == "SMS-CAR-430"){ // spam content
          spam.spamCount++
          if (spam.spamNumbers.findIndex(n => n === toNumber) < 0)
            spam.spamNumbers.push(toNumber)
        }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
          spam.flaggedCount++
          if (spam.flaggedNumbers.findIndex(n => n === toNumber) < 0)
            spam.flaggedNumbers.push(toNumber)
          if (spam.flaggedErrorCodes.findIndex(c => c === code) < 0)
            spam.flaggedErrorCodes.push(code)
          //spam.messages.push(message.text)
        }else if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
          spam.invalidNumberCount++
          if (spam.invalidNumbers.findIndex(n => n === toNumber) < 0)
            spam.invalidNumbers.push(toNumber)
          if (spam.invalidErrorCodes.findIndex(c => c === code) < 0)
            spam.invalidErrorCodes.push(code)
        }else if (code == "SMS-CAR-413 "){  // opted out
          spam.optoutCount++
          if (spam.optoutNumbers.findIndex(n => n === toNumber) < 0)
            spam.optoutNumbers.push(toNumber)
        }else{
          spam.unknownCount++
          if (spam.unknownNumbers.findIndex(n => n === toNumber) < 0)
            spam.unknownNumbers.push(toNumber)
          if (spam.unknownErrorCodes.findIndex(c => c === code) < 0)
            spam.unknownErrorCodes.push(code)
        }
      }
      //console.log(this.analyticsData.failureAnalysis.contents)
      return
    }
    matchedCount = 0
  }
  if (keywords.length > 0){
    var item = {
        message: message.text,
        keywords: keywords,
        acceptedCount: 0,
        acceptedNumbers: [],
        spamCount: 0,
        spamNumbers: [],
        flaggedCount: 0,
        flaggedNumbers: [],
        flaggedErrorCodes: [],
        optoutCount: 0,
        optoutNumbers: [],
        invalidNumberCount: 0,
        invalidNumbers: [],
        invalidErrorCodes: [],
        unknownCount: 0,
        unknownNumbers: [],
        unknownErrorCodes: [],
        messages: []
      }

    var toNumber = message.to[0]
    if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
      item.acceptedCount++
      item.acceptedNumbers.push(toNumber)
    }else{
      if (code == "SMS-UP-430" || code == "SMS-CAR-430"){
        item.spamCount++
        item.spamNumbers.push(toNumber)
      }else if (code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
        item.flaggedCount++
        item.flaggedNumbers.push(toNumber)
        item.flaggedErrorCodes.push(code)
        //item.messages.push(message.text)
      }else if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
        item.invalidNumberCount++
        item.invalidNumbers.push(toNumber)
        item.invalidErrorCodes.push(code)
      }else if (code == "SMS-CAR-413 "){  // opted out
        item.optoutCount++
        item.optoutNumbers.push(toNumber)
      }else{
        item.unknownCount++
        item.unknownNumbers.push(toNumber)
        item.unknownErrorCodes.push(code)
      }
    }
    this.analyticsData.failureAnalysis.push(item)
    //console.log(this.analyticsData.failureAnalysis)
  }
},

// other analytics class
segmentCounts: [],
weekDays: [
  {
    wd: 'Mon',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Tue',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Wed',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Thu',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Fri',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Sat',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  },
  {
    wd: 'Sun',
    outboundCount: 0,
    inboundCount: 0,
    deliveredCount: 0,
    sendingFailedCount: 0,
    deliveryFailedCount: 0,
    sentMsgCost: 0.0,
    receivedMsgCost: 0.0
  }
],
roundTheClock: [],

*/
