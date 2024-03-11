var messageList = []
var recipientPhoneNumbers = []
var timeOffset = 0
var dateStr = ""
var lastVisited = new Date().getTime() - 604800000
//var selectedRecipient = undefined
var pageTokens = undefined
var currentSelectedItem = "all"
var currentSelectedchannel = ""
var pollingTimer = null
var contactList = []
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

  //readContacts()

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

  readMessageStore("")
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
      alert(res.message)
      window.location.href = "/relogin"
    }else{
      alert(res.message)
    }
  });
}

function sendTextMessage(message){
  if (message == ""){
    $("#send-text").focus()
    return alert("Please enter text message!")
  }
  if (params.to == ""){
    return alert("please select a message to reply")
  }
  params.message = message
  //console.log(params)
  var url = "send-message"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      //console.log(res)
      /*
      var msgIndex = messageList.findIndex(o => o.id === msg.id)
      if (msgIndex < 0)
        messageList.splice(0, 0, msg);
      else
        messageList[msgIndex] = msg
      */
      var convoGroup = messageList.find(o => o.conversationId === res.message.threadId)
      convoGroup.conversations.unshift(res.message)
      /*
      if (msgIndex < 0)
        messageList.splice(0, 0, res.message);
      else
        messageList[msgIndex] = msg
      */
      processResult()
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    alert(response);
  });
}

function pollNewMessages(){
  var url = "poll-new-messages"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      for (var msg of res.newMessages){
        var msgIndex = -1
        if (msg.direction == 'Outbound')
          msgIndex = messageList.findIndex(o => o.batchId == msg.batchId)
        else
          msgIndex = messageList.findIndex(o => o.id == msg.id)
        if (msgIndex >= 0){
          messageList[msgIndex] = msg
        }else {
          messageList.splice(0, 0, msg);
        }
      }
      if (res.newMessages.length)
        processResult()
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
  //configs['dateFrom'] = dateFromStr
  //configs['dateTo'] = dateToStr
  //console.log(`from: ${dateFromStr}`)
  //console.log(`to: ${dateToStr}`)
  if (token != ""){
    configs['pageToken'] = token
    pageToken = token
  }else{
    window.clearTimeout(pollingTimer)
  }

  configs['direction'] = $('#direction').val();

  if ($('#my-channels').length > 0){
    var fromChannel = $('#my-channels').val()
    configs['sourceId'] = `["${fromChannel}"]`
  }else{
    var channels = JSON.parse(window.channels)
    configs['sourceId'] = `["${channels[0].id}"]`
  }
  //alert(configs.sourceId)
  if (currentSelectedchannel != configs.sourceId){
    currentSelectedchannel = configs.sourceId
    currentSelectedItem = "all"
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
      //pollingTimer = window.setTimeout(function(){
      //  pollNewMessages()
      //},3000)
    }else if (res.status == "error"){
      $("#conversation").html("")
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
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
  console.log("pageTokens", pageTokens)
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
    var identity = convoGroup.conversations.find( o => o.status == "UserReply" || o.status == "UserInitiated")
    var avatarUri = null
    var name = ""
    if (identity){
      name = `${identity.authorName}`
      avatarUri = identity.avatarUri
    }
    var customer = convoGroup.conversations.find( o => o.status == "New" || o.status == "Ignored" || o.status == "Replied")
    if (customer)
      name += ` - ${customer.authorName}`

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
    html += `<span class="recipient-info">${name}</span><span class="message-count">${convoGroup.conversations.length}</span>`
    html += "</div>"
  }
  $("#recipient-list").html(html)
  showConversation(currentSelectedItem, name)
}

function showConversation(recipient, name){
  console.log("recipient", recipient)
  //console.log(name)
  //var id = parseInt(currentSelectedItem)
  $(`#${currentSelectedItem}`).removeClass("active");
  //id = parseInt(recipient)
  $(`#${recipient}`).addClass("active");
  currentSelectedItem = recipient

  if (messageList.length){
    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    //var totalMessage = 0
    if (recipient == "all"){
      $("#message-input").hide()
      conversationHeight = 50
      setElementsHeight()
      $("#conversation-title").html(`All conversations`)
      //totalMessage = messageList.length
      params.to = ""
      var maxLen = messageList.length - 1
      for (var i=maxLen; i>=0; i--){
        var convoGroup = messageList[i]
        for (var msg of convoGroup.conversations){
          html += createConversationItem(msg, false)
        }
      }
    }else {
      $(`#${currentSelectedItem}-count`).remove()
      conversationHeight = 312
      setElementsHeight()
      //params.to = recipient //selectedRecipient
      params.message = ""
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
        if (msg.status == "New"){
          params.to = msg.id
        }
        html += createConversationItem(msg, false)
      }
    }
    //$("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"
    $("#conversation").html(html)
    $("#conversation").animate({ scrollTop: $("#conversation")[0].scrollHeight}, 100);
  }else{
    $("#conversation").html("No content")
  }
}

function createConversationItem(item, conversation){
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
  if (item.status != "UserReply"){
    line += '<li class="chat-left">'
    line += `<div class="chat-avatar chat-name">${item.authorName}<br>${timeStr}</div>`

    if (item.contentUri != ""){
      //console.log("contenUri", item.contentUri)
      line += `<div class="chat-text"><img src="${item.contentUri}"</img><br/>${msg}</div>`
    }else
      line += `<div class="chat-text">${msg}</div>`
  }else{ // Outbound
    line += '<li class="chat-right">'
    line += `<div class="chat-text">${msg}</div>`
    line += `<div class="chat-avatar chat-name">${timeStr}<br>${item.agentName}</div>`

    if (item.avatarUri != ""){
      line += `<div class="chat-avatar"><img class="avatar" src="${item.avatarUri}"</img></div>`
    }

    //line += `<div class="chat-avatar chat-name">${timeStr}<br><a class="reply" href="#" onclick="openReplyForm('${item.id}', '${item.authorIdentityId}');return false;">${item.authorName}</a></div>`

  }

  line += '</li>'
  return line
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
      alert(res.message)
  });
}

function validateRicipientNumber(number){
  if (number[0] != "+"){
    alert("Please enter recipient phone number with the plus (+) sign in front of country code!")
    return false
  }
  return true
}

function creationTime(creationTime){
  var date = new Date(creationTime)
  var timestamp = date.getTime() //- timeOffset
  var createdDate = new Date (timestamp)
  let dateOptions = { month: 'short', day: 'numeric' }
  var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
  return createdDateStr
}

function logout(){
  window.location.href = "index?n=1"
}
