var messageList = []
var recipientPhoneNumbers = []
var timeOffset = 0
var dateStr = ""
var lastVisited = new Date().getTime() - 604800000
//var selectedRecipient = undefined
var newItems = 0
var pageTokens = undefined
var currentSelectedItem = "all"
var currentSelectedchannel = ""
var pollingTimer = null
var contactList = []
//var channels = undefined
var params = {
  sourceId: "",
  to: "",
  message: ""
}
var conversationHeight = 50
function init(){
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "conversations"
  $(`#${mainMenuItem}`).addClass("active")

  $('#send-text').keyup(function(e) {
    if(e.keyCode == 13) {
      $(this).trigger("enterKey");
    }
  });
  $('#send-text').on("enterKey", function(e){
    sendTextMessage($('#send-text').val())
    $('#send-text').val("")
  });

  timeOffset = new Date().getTimezoneOffset()*60000;

  $( "#fromdatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});

  var past30Days = new Date().getTime() - (86400000 * 30)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past30Days));
  $( "#todatepicker" ).datepicker('setDate', new Date());

  //channels = JSON.parse(window.channels)
  readMessageStore("")
}

function auto_height(elem) {  /* javascript */
    elem.style.height = '1px';
    elem.style.height = `${elem.scrollHeight}px`;
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  $("#control-list-col").height(swindow)

  $("#recipient-list").height(swindow - ($("#col2-header").outerHeight(true) + 120))
  $("#conversation").height(swindow - ($("#conversation-header").outerHeight(true) + conversationHeight))
}

function readContacts(){
  var url = "get-contacts"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      for (var contactGroup of res.contactList){
        for (var contact of contactGroup.contacts){
          if (contactList.length > 0){
            var item = contactList.find(o => o.phoneNumber == contact.phoneNumber)
            if (!item)
              contactList.push(contact)
          }else{
            contactList.push(contact)
          }
        }
      }
      //contactList = res.contactList
      //console.log(JSON.stringify(contactList))
      readMessageStore("")
    }else if (res.status == "failed") {
      _alert(res.message, "Error")
      window.location.href = "/relogin"
    }else{
      _alert(res.message, "Error")
    }
  });
}

function openInitiateMessage(){
  var channels = JSON.parse(window.channels)
  var channel = channels.find( o => o.id == currentSelectedchannel)
  if (channel){
    switch (channel.sourceType) {
      case "WhatsApp":
        var contactsList = JSON.parse(window.contacts)
        openInitiateWAMessage(channel.id, channel.name, contactsList)
        break;
      case "Twitter":
        //openInitiateFBMessage(channel.id, channel.name)
        _alert("Not yet supported!", "Info")
        break;
      case "LinkedIn":
        _alert("Not yet supported!", "Info")
        break;
      case "FaceBook":
        openInitiateFBMessage(channel.id, channel.name)
        break;
      default:
        break;

    }
  }
}

function sendTextMessage(message){
  if (message == ""){
    $("#send-text").focus()
    return _alert("Please enter text message!")
  }
  if (params.to == ""){
    return _alert("please select a message to reply")
  }
  params.message = message
  //console.log(params)
  var url = "send-message"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      //console.log(res)
      var convoGroup = messageList.find(o => o.conversationId === res.message.threadId)
      convoGroup.conversations.unshift(res.message)
/*
      window.setTimeout(function(msgId){
        checkSendMessageStatus(msgId)
      },1000, res.message.id)
*/
      processResult()
    }else if (res.status == "error"){
      _alert(res.message, "Error")
    }else{
      if (res.message)
        _alert(res.message, "Error")
      else
        _alert("You have been logged out. Please login again.", "Error")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    _alert(response, "Error");
  });
}

function checkSendMessageStatus(messageId){
  var url = `poll-sending-message-status?id=${messageId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      if (res.message.synchronizationStatus == "ExportPending"){
        window.setTimeout(function(msgId){
          checkSendMessageStatus(msgId)
        },3000, messageId)
      }else {
        var convoGroup = messageList.find(o => o.conversationId === res.message.threadId)
        if (convoGroup){
          let msgIndex = convoGroup.conversations.findIndex(o => o.id === res.message.id)
          if (msgIndex >= 0){
              convoGroup.conversations[msgIndex] = res.message
              processResult()
          }
        }
      }
    }else if (res.status == "error"){
      _alert(res.message, "Error")
    }else{
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}


function pollNewMessages(){
  var url = "poll-new-messages"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      // check if new message is the current open channel
      var newMessages = false
      for (var msg of res.newMessages){
        if (currentSelectedchannel != msg.channelId){
          var channel = $(`#my-channels option[value="${msg.channelId}"]`)
          if (channel){
            var text = channel.text()
            var textParts = text.split("+")
            var count = 1
            newItems++
            var nameWithNewItems = ''
            if (textParts.length > 1){
              count = parseInt(textParts[1].trim())
              count += 1
              nameWithNewItems = `${textParts[0]} +${count}`
            }else{
              nameWithNewItems = `${textParts[0]} +1`
            }
            $(`#my-channels option[value="${msg.channelId}"]`).text(nameWithNewItems)
            $('#my-channels').selectpicker('refresh');
          }
          if (newItems > 0)
            $("#new-item-indicator").html(`+${newItems}`)
          else
            $("#new-item-indicator").html('')
          continue
        }else
          newMessages = true

        var convoGroup = messageList.find(o => o.conversationId === msg.threadId)
        if (convoGroup){
            let msgIndex = convoGroup.conversations.findIndex(o => o.id === msg.id)
            if (msgIndex >= 0){
                convoGroup.conversations[msgIndex] = msg
            }else{
              convoGroup.conversations.unshift(msg)
            }
        }else{
          var newConvo = {
            conversationId: msg.threadId,
            conversations: [msg]
          }
          messageList.unshift(newConvo)
        }
      }
      if (res.newMessages.length && newMessages)
        processResult()
      //console.log("New message count:", res.newMessages.length)
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },3000)
    }else{
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function readMessageStore(token){
  var period = $("#period").val()
  if (period == "between"){
    if(!$("#between-date").is(":visible")){
      $("#between-date").show()
      return
    }
  }else{
    $("#between-date").hide()
  }
  var dateFromStr = ""
  var timestamp = new Date().getTime()
  var dateToStr = new Date(timestamp).toISOString()
  switch (period) {
    case "last-hour":
      timestamp -= 3600000
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "last-24hour":
      timestamp -= 86400000
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "last-seven-day":
      timestamp -= (86400000 * 7)
      dateFromStr = new Date(timestamp).toISOString()
      break
    case "between":
      var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
      var tempTime = tempDate.getTime()// + timeOffset
      dateFromStr = new Date(tempTime).toISOString()

      tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
      tempTime = tempDate.getTime()// + timeOffset
      dateToStr = new Date(tempTime).toISOString()
      break
    default:
      return
  }

  var configs = {
    dateFrom: dateFromStr,
    dateTo: dateToStr,
    perPage: $('#page-size').val()
  }

  if (token != ""){
    configs['pageToken'] = token
    pageToken = token
  }else{
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }
  if (pollingTimer){
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }

  //configs['direction'] = $('#direction').val();

  var fromChannel = $('#my-channels').val()
  //if ($('#my-channels').length > 0){
  if (fromChannel != ""){
    //var fromChannel = $('#my-channels').val()
    configs['sourceId'] = `["${fromChannel}"]`
  }else{
    //var channels = JSON.parse(window.channels)
    //configs['sourceId'] = `["${channels[0].id}"]`
    return
  }
  var channel = $(`#my-channels option[value="${fromChannel}"]`)
  if (channel){
    var text = channel.text()
    var textParts = text.split("+")
    if (textParts.length > 1){
      var nameWithNewItems = textParts[0].trimEnd()
      console.log(nameWithNewItems)
      $(`#my-channels option[value="${fromChannel}"]`).text(nameWithNewItems)
      $('#my-channels').selectpicker('refresh');
      var count = parseInt(textParts[1].trim())
      newItems -= count
      if (newItems > 0)
        $("#new-item-indicator").html(`+${newItems}`)
      else
        $("#new-item-indicator").html('')
    }
  }
  //alert(configs.sourceId)
  if (currentSelectedchannel != fromChannel){
    currentSelectedchannel = fromChannel
    currentSelectedItem = "all"
    //
    var channels = JSON.parse(window.channels)
    var channel = channels.find( o => o.id == currentSelectedchannel)
    if (channel){
      switch (channel.sourceType) {
        case "WhatsApp":
          $("#contact-id").html(formatPhoneNumber(channel.contactId))
          $("#contact-id-block").show()
          break;
        default:
        $("#contact-id-block").hide()
          break;
      }
    }
  }
  params.sourceId = configs.sourceId
  messageList = []
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#conversation").html(readingAni)

  var url = "read-message-store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      $("#search-number").focus()
      messageList = res.result
      //console.log(messageList)
      pageTokens = res.pageTokens
      processResult()
      // closed until notification payload issues are fixed
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      },5000)
      //
    }else if (res.status == "error"){
      $("#conversation").html("")
      _alert(res.message, "Error")
    }else{
      if (res.message)
        _alert(res.message, "Error")
      else
        _alert("You have been logged out. Please login again.", "Error")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    _alert(response.statusText, "Error");
  });
}

// show inbound and outbound message count
function processResult(){
  var totalInbound = 0
  var totalOutbound = 0
  recipientPhoneNumbers = []
  //console.log(messageList)

  var totalMsg = 0
  for (var message of messageList){
    totalMsg += message.conversations.length
  }
  //var exist = recipientPhoneNumbers.find(o => o.number === currentSelectedItem)
  //if (exist == undefined)
  //currentSelectedItem = "all"
  //$("#left_pane").show()
  //$("#downloads").show()

  createConversationsList(totalMsg)
  //console.log("pageTokens", pageTokens)
  if (pageTokens != undefined){
    if (pageTokens.nextPageToken != ""){
      var link = $("#next-block");
      link.attr("href",`javascript:readMessageStore("${pageTokens.nextPageToken}")`);
      link.css('display', 'inline');
    }else{
      var link = $("#next-block");
      link.attr("href", "#");
      link.css('display', 'none');
    }
    if (pageTokens.previousPageToken != ""){
      var link = $("#prev-block");
      link.attr("href",`javascript:readMessageStore("${pageTokens.previousPageToken}")`);
      link.css('display', 'inline');
    }else{
      var link = $("#prev-block");
      link.attr("href", "#");
      link.css('display', 'none');
    }
  }else {
    $("#next-page").hide()
  }
}
function createConversationsList(totalMsg){
  var html = `<div id='0' class='recipient-item' onclick='showConversation("all", "")'><div class="recipient-info">All conversations</div><div class="message-count">${totalMsg}</div></div>`
  for (var convoGroup of messageList){
    // possible statuses: New, Assigned, Replied, UserReply, UserInitiated, Ignored
    var identity = convoGroup.conversations.find( o => o.status == "UserReply" || o.status == "UserInitiated" || o.status == "PendingApproval")
    var avatarUri = null
    var name = ""
    if (identity){
      name = identity.authorName
      avatarUri = identity.avatarUri
    }
    var customer = convoGroup.conversations.find( o => o.status == "New" || o.status == "Ignored" || o.status == "Replied")
    if (customer)
      name += (name != "") ? ` - ${customer.authorName}` : customer.authorName

    if (convoGroup.conversations.length == 0){
        console.log("not likely")
    }else if (convoGroup.conversations.length == 1){
        name += ` (${creationTime(convoGroup.conversations[0].creationTime)})`
    }else{
        var lastMSg = convoGroup.conversations.length - 1
        name += ` (${creationTime(convoGroup.conversations[lastMSg].creationTime)}`
        name += ` - ${creationTime(convoGroup.conversations[0].creationTime)})`
    }

    html += `<div id='${convoGroup.conversationId}' class='recipient-item' onclick='showConversation("${convoGroup.conversationId}", "${name}")'>`
    if (avatarUri)
      html += `<span class="avatar"><img class="avatar" src="${avatarUri}"</img></span>`
    var inboundCount = 0
    var outboundCount = 0
    for (var item of convoGroup.conversations){
      if (item.status == "New" || item.status == "Ignored" || item.status == "Replied")
        inboundCount++
      else
        outboundCount++
    }
    html += `<span class="recipient-info">${name}</span><span class="message-count">${inboundCount}/${outboundCount}</span>`
    html += "</div>"
  }
  $("#recipient-list").html(html)
  showConversation(currentSelectedItem, name)
}

function showConversation(selectedConvo, name){
  //console.log("recipient", selectedConvo)
  //console.log(name)
  //var id = parseInt(currentSelectedItem)
  $(`#${currentSelectedItem}`).removeClass("active");
  //id = parseInt(recipient)
  $(`#${selectedConvo}`).addClass("active");
  currentSelectedItem = selectedConvo

  if (messageList.length){
    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    //var totalMessage = 0
    if (selectedConvo == "all"){
      $("#message-input").hide()
      conversationHeight = 50
      setElementsHeight()
      $("#conversation-title").html(`All conversations`)
      //totalMessage = messageList.length
      params.to = ""

      var maxLen = messageList.length - 1
      for (var i=maxLen; i>=0; i--){
        var convoGroup = messageList[i]
        var convoLen = convoGroup.conversations.length - 1
        for (var n=convoLen; n>=0; n--){
          var msg = convoGroup.conversations[n]
          if (msg.status == "New" || msg.status == "Ignored" || msg.status == "Replied"){
            params.to = msg.id
          }
          html += createConversationItem(msg, false)
        }
      }
    }else { // display selected conversation
      $(`#${currentSelectedItem}-count`).remove()
      conversationHeight = 312
      setElementsHeight()
      //params.to = recipient //selectedRecipient
      params.message = ""
      params.to = ""
      $("#message-input").show()
      var title = `<span>${name}</span>`
      $("#conversation-title").html(title)

      var convoGroup = messageList.find(o => o.conversationId == currentSelectedItem)
      if (!convoGroup){
        convoGroup = messageList[0]
      }
      var maxLen = convoGroup.conversations.length - 1
      for (var i=maxLen; i>=0; i--){
        var msg = convoGroup.conversations[i]
        if (msg.status == "New" || msg.status == "Ignored" || msg.status == "Replied"){
          params.to = msg.id
        }
        html += createConversationItem(msg, true)
      }
      if (params.to == ""){
        // disable the input for now. Should be enable for initiating a new message!
        $("#message-input").hide()
      }else{
        $("#message-input").show()
      }
    }
    //$("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"
    $("#conversation").html(html)
    $("#conversation").animate({ scrollTop: $("#conversation")[0].scrollHeight}, 100);
  }else{
    $("#conversation-title").html("")
    $("#conversation").html("No content")
    $("#message-input").hide()
  }
}

function createConversationItem_timePeriod(item, conversation){
  //console.log("item", item)
  var line = ""
  var date = new Date(item.creationTime)
  var createdTimestamp = date.getTime() //- timeOffset
  var createdDate = new Date (createdTimestamp)
  let dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
  let timeOptions = { hour12: false }
  var timeStr =  createdDate.toLocaleTimeString("en-US", timeOptions).substr(0, 5)

  if (dateStr != createdDateStr){
    dateStr = createdDateStr
    // create date separation
    line += `<li class="separator"><div class="date-line">----- ${dateStr} -----</div></li>`
  }

  var nowTimestamp = new Date().getTime()
  var ageInSeconds = (nowTimestamp - createdTimestamp) / 1000
  var age = formatMessageAge(ageInSeconds)

  var msg = (item.body != null) ? item.body.replace(/\r?\n/g, "<br>") : ""
  if (item.status == "UserInitiated" || item.status == "UserReply" || item.status == "PendingApproval"){ // Outbound
    line += '<li class="chat-right">'
    if (item.synchronizationStatus == "Success"){
      line += `<div class="chat-text">${msg}</div>`
      line += `<div class="chat-avatar chat-name">${age}<br>${item.agentName}</div>`
    }else if (item.synchronizationStatus == "ExportPending"){
      line += `<div class="chat-text warning">${msg}</div>`
      line += `<div class="chat-avatar chat-name">Pending<br>${item.agentName}</div>`
    }else if (item.synchronizationStatus == "ExportAborted"){
      line += `<div class="chat-text error">${msg}</div>`
      line += `<div class="chat-avatar chat-name">${age}<br>${item.agentName}</div>`
    }
    if (item.avatarUri != ""){
      line += `<div class="chat-avatar"><img class="avatar" src="${item.avatarUri}"</img></div>`
    }
    //line += `<div class="chat-avatar chat-name">${timeStr}<br><a class="reply" href="#" onclick="openReplyForm('${item.id}', '${item.authorIdentityId}');return false;">${item.authorName}</a></div>`
  }else{
    line += '<li class="chat-left">'
    line += `<div class="chat-avatar chat-name">${item.authorName}<br>${age}</div>`

    if (item.contentUri != ""){
      //console.log("contenUri", item.contentUri)
      line += `<div class="chat-text"><img src="${item.contentUri}"</img><br/>${msg}</div>`
    }else
      line += `<div class="chat-text">${msg}</div>`
  }

  line += '</li>'
  return line
}

function createConversationItem(item, conversation){
  //console.log("item", item)
  var line = ""
  var date = new Date(item.creationTime)
  var timestamp = date.getTime() //- timeOffset
  var createdDate = new Date (timestamp)
  let dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
  let timeOptions = { hour12: false }
  var timeStr =  createdDate.toLocaleTimeString("en-US", timeOptions).substr(0, 5)
  if (dateStr != createdDateStr){
    dateStr = createdDateStr
    // create date separation
    line += `<li class="separator"><div class="date-line">----- ${dateStr} -----</div></li>`
  }

  var msg = (item.body != null) ? item.body.replace(/\r?\n/g, "<br>") : ""
  if (item.status == "UserInitiated" || item.status == "UserReply" || item.status == "PendingApproval"){ // Outbound
    line += '<li class="chat-right">'
    if (item.synchronizationStatus == "Success"){
      line += `<div class="chat-text">${msg}</div>`
      line += `<div class="chat-avatar chat-name">${timeStr}<br>${item.agentName}</div>`
    }else if (item.synchronizationStatus == "ExportPending"){
      line += `<div class="chat-text warning">${msg}</div>`
      line += `<div class="chat-avatar chat-name">Pending<br>${item.agentName}</div>`
    }else if (item.synchronizationStatus == "ExportAborted"){
      line += `<div class="chat-text error">${msg}</div>`
      line += `<div class="chat-avatar chat-name">${timeStr}<br>${item.agentName}</div>`
    }
    if (item.avatarUri != ""){
      line += `<div class="chat-avatar"><img class="avatar" src="${item.avatarUri}"</img></div>`
    }
    //line += `<div class="chat-avatar chat-name">${timeStr}<br><a class="reply" href="#" onclick="openReplyForm('${item.id}', '${item.authorIdentityId}');return false;">${item.authorName}</a></div>`
  }else{
    line += '<li class="chat-left">'
    line += `<div class="chat-avatar chat-name">${item.authorName}<br>${timeStr}</div>`

    if (item.contentUri != ""){
      //console.log("contenUri", item.contentUri)
      line += `<div class="chat-text"><img src="${item.contentUri}"</img><br/>${msg}</div>`
    }else{
      line += `<div class="chat-text">${msg}</div>`
      if (conversation)
        line += `<a href="#" class="chat-avatar" onclick="getAnswer('${msg}')"><img src="/img/bot.png" style="width: 30px; height: 35px" /></a>`
    }
  }

  line += '</li>'
  return line
}

function getAnswer(msg){
  //$("#send-text").val(msg)
  //return
    var bodyParams = {
      message: msg
    }
    var url = 'get-answer'
    var posting = $.post( url, bodyParams );
    posting.done(function( res ) {
      if (res.status == "ok") {
        sendTextMessage(res.message)
        //$("#send-text").val(res.message)
        //$("#send-text").focus()
      }else if (res.status == "error"){
        _alert(res.message, "Error")
      }else{
        if (res.message)
          _alert(res.message, "Error")
      }
    });
    posting.fail(function(response){
      _alert(response.statusText, "Error");
    });
}

function getContactName(number){
  var contact = contactList.find(o => o.phoneNumber === number)
  if (contact)
    return `${contact.fname} ${contact.lname}`

  return formatPhoneNumber(number)
}

function downloadMessageStore(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "download-hv-message-store?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      _alert(res.message, "Error")
  });
}


function creationTime(creationTime){
  var date = new Date(creationTime)
  var timestamp = date.getTime() //- timeOffset
  var createdDate = new Date (timestamp)
  let dateOptions = { month: 'short', day: 'numeric' }
  var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
  return createdDateStr
}

const MONTH = 3600 * 24 * 30
const DAY = 3600 * 24
const HOUR = 3600
const MIN = 60

function formatMessageAge(ageInSeconds){
  let now = new Date().getTime() / 1000
  var age = Math.floor(ageInSeconds / MONTH)

  if (age >= 1){
    return `${age} ${(age > 2) ? " months" : " month"}`
  }else{
    age = Math.floor(ageInSeconds / DAY)
    if (age >= 1){
      return `${age} ${(age > 2) ? " days" : " day"}`
    }else{
      age = Math.floor(ageInSeconds / HOUR)
      if (age >= 1){
        return `${age} ${(age > 2) ? " hours" : " hour"}`
      }else{
        age = Math.floor(ageInSeconds / MIN)
        if (age >= 1){
          return `${age} ${(age > 2) ? " mins" : " min"}`
        }else{
          return `${age} ${(age > 2) ? " secs" : " sec"}`
        }
      }
    }
  }
}

function logout(){
  window.location.href = "index?n=1"
}
