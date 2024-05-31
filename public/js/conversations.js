//import { EmojiArea } from './assets/js/jquery.emojiarea.js';
var recipientPhoneNumbers = []
var timeOffset = 0
var dateStr = ""
var lastVisited = new Date().getTime() - 604800000
//var selectedRecipient = undefined
var newItems = 0
//var pageTokens = undefined
//var currentSelectedItem = "all"
var currentSelectedchannel = ""
var pollingTimer = null
var contactList = []
var channels = undefined
var displayedChannels = []
var conversationHeight = 50

function init(){
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "conversations"
  $(`#${mainMenuItem}`).addClass("active")
/*
  $('#send-text').keyup(function(e) {
    if(e.keyCode == 13) {
      $(this).trigger("enterKey");
    }
  });
  $('#send-text').on("enterKey", function(e){
    sendTextMessage($('#send-text').val())
    $('#send-text').val("")
  });
*/
  timeOffset = new Date().getTimezoneOffset()*60000;
  /*
  $( "#fromdatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});

  var past30Days = new Date().getTime() - (86400000 * 30)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past30Days));
  $( "#todatepicker" ).datepicker('setDate', new Date());
  */
  //console.log(window.channels)
  channels = JSON.parse(window.channels)
  //displayedChannels = []
  //console.log(window.displayedChannels)
  //if (displayedChannels.length == 0)
  displayedChannels = JSON.parse(window.displayedChannels)

  if (displayedChannels.length > 0){
    for (var channel of displayedChannels){
      createChannelContainer(channel)
      readMessageStore(channel.id, "")
    }
  }else{
    console.log("No displayed channel")
  }

}

function addSelectedChannel(){
  var selectedChannel = $('#my-channels').val()
  if (displayedChannels.find(o => o.id === selectedChannel)){
    _alert("Already displayed")
    return
  }
  var channel = channels.find( o => o.id == selectedChannel)
  channel['messageList'] = []
  channel['params'] = {
    id: selectedChannel,
    to: "",
    message: ""
  }
  channel['pageTokens'] = []
  channel['currentSelectedItem'] = `all-${selectedChannel}`
  displayedChannels.push(channel)
  saveUserSettings()
  createChannelContainer(channel)
  readMessageStore(channel.id, "")
}

function saveUserSettings(){
    let url = 'save-user-settings'
    let updatedChannels = []
    for (var ch of displayedChannels){
      let c = {...ch}
      c.messageList = []
      c.pageTokens = []
      updatedChannels.push(c)
    }
    var bodyParams = {
      displayedChannels: JSON.stringify(updatedChannels)
    }
    var posting = $.post( url, bodyParams );
    posting.done(function( res ) {
      if (res.status == "ok"){
        console.log(res)
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

function createChannelContainer(channel){
  console.log(channel)
  var mainContainer = $("#container")
  var main = $(`<div id='main-${channel.id}'>`)
    .addClass('col-lg-3 channel-block')
    .appendTo(mainContainer);

  // add header
  var header = $(`<div>`) // , { text: channel.name }
    .addClass(`channel-name`)
    .appendTo(main);

    var phoneNumber = ""
    var avatar = $(`<span>`)
      .addClass(`avatar`)
      .appendTo(header);

    if (channel.avatarUri && channel.avatarUri != ""){
      $(`<img>`, { src: channel.avatarUri })
        .addClass(`avatar`)
        .appendTo(avatar);
      if (channel.channelType == "WhatsApp"){
        phoneNumber = " - " + formatPhoneNumber(channel.contactId)
      }
    }else{ // use media icon
      if (channel.channelType == "FaceBook"){
        $(`<img>`, { src: './img/facebook.png' })
          .addClass(`avatar`)
          .appendTo(avatar);
      }else if (channel.channelType == "LinkedIn"){
        $(`<img>`, { src: './img/linkedin.png' })
          .addClass(`avatar`)
          .appendTo(avatar);
      }else if (channel.channelType == "WhatsApp"){
        $(`<img>`, { src: './img/whatsapp.png' })
          .addClass(`avatar`)
          .appendTo(avatar);
          phoneNumber = " - " + formatPhoneNumber(channel.contactId)
      }else if (channel.channelType == "Apple"){
        $(`<img>`, { src: './img/apple.png' })
          .addClass(`avatar`)
          .appendTo(avatar);
      }else if (channel.channelType == "Twitter"){
        $(`<img>`, { src: './img/twitter.png' })
          .addClass(`avatar`)
          .appendTo(avatar);
      }
    }

    var name = $(`<span>`, { text: `${channel.name}${phoneNumber}` })
        .appendTo(header);

    var closeBtn = $(`<img>`, { src: './img/close.png' })
      .addClass(`close-tab`)
      .attr('onclick', `closeTab('${channel.id}')`)
      .appendTo(avatar);

  var navigationBar = $(`<div id='navi-${channel.id}'>`) // , { text: channel.name }
      .addClass(`channel-navi`)
      .appendTo(main);

      $(`<a>`,{
          id: `next-block-${channel.id}`,
          text: '>>',
          title: 'next page',
          href: '#'
        })
        .addClass("navi-item next")
        .appendTo(navigationBar);

  $(`<a>`,{
        id: `prev-block-${channel.id}`,
        text: '<<',
        title: 'prev page',
        href: '#'
      }).addClass("navi-item")
      .appendTo(navigationBar);


  var recipientList = $(`<div id='recipient-list-${channel.id}'>`)
    .addClass(`scrollable-list`)
    .appendTo(main);

  var chatMsgHeader = $(`<div>`, { text: "Chat messages"})
    .addClass('chat-header')
    .appendTo(main);

  var newConvo = $(`<button>`, {text: "New Conversation"})
    .addClass("new-convo-button")
    .attr('onclick', `openInitiateMessage('${channel.channelType}', '${channel.id}', '${channel.name}')`)
    .appendTo(chatMsgHeader);
  /*
  if (channel.id == "65c3fdd9527bf900079cefcb"){
    // only this channel support template
  }
  */

  var conversationList = $(`<div id='conversation-${channel.id}'>`)
    .addClass(`conversation`)
    .appendTo(main);

    var inputField = $(`<div id='message-input-${channel.id}'>`)
      .css('style', "display: none")
      .addClass(`message-input`)
      .appendTo(main);

    /*
    var inputArea =  $(`<div id='input-area-${channel.id}' data-emojiarea data-type="unicode" data-global-picker="false">`)
    var icon = $(`<span>`)
      .addClass('emoji-button')
      .css('style', "height: 40px")
      .appendTo(inputArea);

    var img = $(`<img>`, { src: "/img/emoji.png" })
      .addClass('medium-icon')
      .appendTo(icon);

    var msgField = $(`<input type="text" id='send-text-${channel.id}'>`)
      .addClass('form-control send-text')
      .css('style', "display: inline; height: 40px")
      .appendTo(inputArea);

    inputArea.appendTo(inputField)
    */
    //var html = '<div data-emojiarea data-type="unicode" data-global-picker="false">'
    //html += '<span class="emoji-button" style="height: 40px"><img class="medium-icon" src="/img/emoji.png"></img></span>'
    //html = `<div class="send-text"><textarea id="send-text-${channel.id}" class="form-control text-input" rows="2" cols="50" placeholder="Reply to this conversation"></textarea>`
    var html = `<textarea id="send-text-${channel.id}" class="emojionearea-editor"/>`
    html += `<div id="container-${channel.id}" class="emojionearea-container"></div>`
    html += `<div><img class="send-btn" src="/img/send.png" onclick="sendTextMessage('${channel.id}', '')"/></div>`



      //html += '<div id="container1" class="emojionearea-container"></div>'
      //html += `<div><img class="send-btn" src="/img/send.png" onclick="sendTextMessage('${channel.id}', '')"/></div>`
      //html += `<img class="send-btn" src="/img/send.png" onclick="sendTextMessage('${channel.id}', '')"></img>`
      inputField.html(html)
      //$('#emojionearea1').height($('#container1').outerHeight());

      $(`#send-text-${channel.id}`).emojioneArea({
              container: $(`#container-${channel.id}`), // by jQuery object
              searchPosition: "bottom"
          });
    //$(document).ready(function() {
      //$(`#send-text-${channel.id}`).emojioneArea({
      //  hidePickerOnBlur: true
      //});
    //});

    /*
    $(`#send-text-${channel.id}`).on('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        */
/*
    $(`#send-text-${channel.id}`).keyup(function(e) {
      if(e.keyCode == 13) {
        $(this).trigger("enterKey");
      }
    });
    $(`#send-text-${channel.id}`).on("enterKey", function(e){
      sendTextMessage(channel.id, $(`#send-text-${channel.id}`).val())
      $(`#send-text-${channel.id}`).val("")
    });
*/
  /*
  <div class="col-lg-3">
    <div class="block_space">
      <input type="button" class="form-control" style="display: inline;width: 150px;" value="Start a conversation" onclick="openInitiateMessage()" data-toggle="popover" data-trigger="hover" data-placement="right" data-content="Initiate a new conversation"></input>
    </div>
    <div id="recipient-list-1" class="scrollable-list"></div>
    <div id="conversation-1" class="conversation"></div>
    <div id="message-input-1" style="display: none">
      <div data-emojiarea data-type="unicode" data-global-picker="false">
        <span class="emoji-button" style="height: 40px"><img class="medium-icon" src="/img/emoji.png"></img></span>
        <input type="text" id="send-text" class="form-control" style="display: inline;height: 40px" size="auto" placeholder="Enter text here" data-toggle="popover" data-trigger="hover" data-placement="right" data-content="Reply to this conversation"></input>
      </div>
    </div>
  </div>
  */
}


function closeTab(channelId){
  var channel = $(`#main-${channelId}`)
  channel.remove()
  var index = displayedChannels.findIndex(o => o.id === channelId)
  if (index >= 0){
    displayedChannels.splice(index, 1)
    saveUserSettings()
  }
}

function auto_height(elem) {  /* javascript */
    elem.style.height = '1px';
    elem.style.height = `${elem.scrollHeight}px`;
}

function setElementsHeight(){
  var height = $(window).height() //- $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  //$("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  //$("#control-list-col").height(swindow)

  //$("#recipient-list").height(swindow - ($("#col2-header").outerHeight(true) + 120))
  //$("#conversation").height(swindow - ($("#conversation-header").outerHeight(true) + conversationHeight))
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
      readMessageStore("", "")
    }else if (res.status == "failed") {
      _alert(res.message, "Error")
      window.location.href = "/relogin"
    }else{
      _alert(res.message, "Error")
    }
  });
}

function openInitiateMessage(channelType, channelId, channelName){
    switch (channelType) {
      case "WhatsApp":
        if (channelId == "65c3fdd9527bf900079cefcb"){
          // only this channel support template
          var contactsList = JSON.parse(window.contacts)
          openInitiateWAMessage(channelId, channelName, contactsList)
        }else{
          _alert("This WhatsApp channel does not have any template.")
        }

        break;
      case "Twitter":
        //openInitiateFBMessage(channel.id, channel.name)
        _alert("Not yet supported!", "Info")
        break;
      case "LinkedIn":
        _alert("Not yet supported!", "Info")
        break;
      case "FaceBook":
        openInitiateFBMessage(channelId, channelName)
        break;
      default:
        break;

    }
}

function sendTextMessage(channelId, message){
  if (message == ''){
    message = $(`#send-text-${channelId}`).val()
    $(`#send-text-${channelId}`).data("emojioneArea").setText('');
  }
  if (message == ""){
    $(`#send-text-${channelId}`).focus()
    return _alert("Please enter text message!")
  }
  var channel = displayedChannels.find(o => o.id === channelId)
  if (channel){
    if (channel.params.to == ""){
      return _alert("please select a message to reply")
    }
    channel.params.message = message
    //console.log(params)
    var url = "send-message"
    var posting = $.post( url, channel.params );
    posting.done(function( res ) {
      if (res.status == "ok"){
        //console.log(res)
        var convoGroup = channel.messageList.find(o => o.conversationId === res.message.inReplyToAuthorIdentityId)
        convoGroup.conversations.unshift(res.message)
  /*
        window.setTimeout(function(msgId){
          checkSendMessageStatus(msgId)
        },1000, res.message.id)
  */
        processResult(channel, 0, 0)
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
}

/*
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
*/

function pollNewMessages(){
  var url = "poll-new-messages"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      // check if new message is the current open channel
      var newMessages = false
      for (var msg of res.newMessages){
        var channel = displayedChannels.find(o => o.id === msg.channelId)
        if (channel){
          var threadId = ""
          if (msg.status == "New" || msg.status == "Ignored" || msg.status == "Replied"){
            // inbound msg
            threadId = msg.authorIdentityId
            var convoGroup = channel.messageList.find(o => o.conversationId == msg.authorIdentityId)
            if (convoGroup){
              let msgIndex = convoGroup.conversations.findIndex(o => o.id === msg.id)
              if (msgIndex >= 0){
                  convoGroup.conversations[msgIndex] = msg
              }else{
                convoGroup.conversations.unshift(msg)
              }
            }else{
              var newConvo = {
                conversationId: msg.authorIdentityId,
                conversations: [item]
              }
              channel.messageList.unshift(newConvo)
            }
          }else{ // outbound msg
            threadId = msg.inReplyToAuthorIdentityId
            var convoGroup = channel.messageList.find(o => o.conversationId == msg.inReplyToAuthorIdentityId)
            if (convoGroup){
              let msgIndex = convoGroup.conversations.findIndex(o => o.id === msg.id)
              if (msgIndex >= 0){
                  convoGroup.conversations[msgIndex] = msg
              }else{
                convoGroup.conversations.unshift(msg)
              }
            }else{
              var newConvo = {
                conversationId: record.inReplyToAuthorIdentityId,
                conversations: [item]
              }
              channel.messageList.unshift(newConvo)
            }
          }
          if (res.newMessages.length)
            processResult(channel, res.newMessages.length, threadId)
          /*
          var convoGroup = channel.messageList.find(o => o.conversationId === msg.threadId)
          if (convoGroup){
              let msgIndex = convoGroup.conversations.findIndex(o => o.id === msg.id)
              if (msgIndex >= 0){
                  convoGroup.conversations[msgIndex] = msg
              }else{
                convoGroup.conversations.unshift(msg)
              }
          }else{
            var newConvo = {
              conversationId: msg.inReplyToAuthorIdentityId, //msg.threadId,
              conversations: [msg]
            }
            channel.messageList.unshift(newConvo)
          }

          if (res.newMessages.length)
            processResult(channel, res.newMessages.length, msg.threadId)
          */
        }else{
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
            }else{
              continue
            }
            if (newItems > 0)
              $("#new-item-indicator").html(`+${newItems}`)
            else
              $("#new-item-indicator").html('')
          }
        }

      //console.log("New message count:", res.newMessages.length)
      pollingTimer = window.setTimeout(function(){
        pollNewMessages()
      }, 3000)
    }else{
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function readMessageStore(channelId, token){
  var channel = displayedChannels.find(o => o.id == channelId)
  if (!channel)
    return
  var configs = {
    dateFrom: "",
    dateTo: "",
    perPage: 100
  }

  if (token == "next"){
    configs['pageToken'] = channel.pageTokens[channel.tokenIndex+1]
    //channel.tokenIndex++
  } else if (token == 'prev') {
    configs['pageToken'] = channel.pageTokens[channel.tokenIndex-1]
    //channel.tokenIndex--
  }else{
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }

  /*
  if (token != ""){
    configs['pageToken'] = token
    pageToken = token
  }else{
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }
  */

  if (pollingTimer){
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }

  configs['channelId'] = `["${channel.id}"]`
  /*
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
  */

  /*
  if (currentSelectedchannel != fromChannel){
    currentSelectedchannel = fromChannel
    currentSelectedItem = "all"
    //
    var channel = channels.find( o => o.id == currentSelectedchannel)
    if (channel){
      switch (channel.channelType) {
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
  */
  //params.sourceId = configs.sourceId
  channel.messageList = []
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#conversation").html(readingAni)

  var url = "read-message-store"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      $("#search-number").focus()
      channel.messageList = res.result
      //console.log(messageList)
      if (token == ""){
        channel.pageTokens = []
        channel.tokenIndex = 0
        channel.pageTokens.push(res.paging.pageToken)
        if (res.paging.nextPageToken && res.paging.nextPageToken != "")
          channel.pageTokens.push(res.paging.nextPageToken)
        //console.log(channel.pageTokens)
      }else{
        if (token == "next"){
          configs['pageToken'] = channel.pageTokens[channel.tokenIndex+1]
          channel.tokenIndex++
        } else if (token == 'prev') {
          configs['pageToken'] = channel.pageTokens[channel.tokenIndex-1]
          channel.tokenIndex--
        }
        //var index = channel.pageTokens.findIndex(o => o === token)
      }
      processResult(channel, 0, 0)
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
function processResult(channel, newMsgCount, threadId){
  var totalInbound = 0
  var totalOutbound = 0
  recipientPhoneNumbers = []
  //console.log(channel)

  var totalMsg = 0
  for (var message of channel.messageList){
    totalMsg += message.conversations.length
  }

  createConversationsList(channel, totalMsg, newMsgCount, threadId)
  //console.log("pageTokens", channel.pageTokens)
  //managePagination(channel)
  /*
  if (channel.pageTokens.length > 0){
    if (channel.pageTokens.nextPageToken != ""){
      var link = $(`#next-block-${channel.id}`);
      var token = channel.pageTokens[channel.tokenIndex+1]
      link.attr("href",`javascript:readMessageStore('${channel.id}', "${token}")`);
      link.css('display', 'inline');
    }else{
      var link = $(`#next-block-${channel.id}`);
      link.attr("href", "#");
      link.css('display', 'none');
    }
    if (channel.pageTokens.previousPageToken != ""){
      var link = $(`#prev-block-${channel.id}`);
      link.attr("href",`javascript:readMessageStore('${channel.id}', "${channel.pageTokens.previousPageToken}")`);
      link.css('display', 'inline');
    }else{
      var link = $(`#prev-block-${channel.id}`);
      link.attr("href", "#");
      link.css('display', 'none');
    }
    $(`#navi-${channel.id}`).show()
  }else {
    $(`#navi-${channel.id}`).hide()
  }
  */
}

function managePagination(channel){
  if (channel.pageTokens.length > 0){
    if (channel.tokenIndex < channel.pageTokens.length - 1){
      var link = $(`#next-block-${channel.id}`);
      link.attr("href",`javascript:readMessageStore('${channel.id}', 'next')`);
      link.css('display', 'inline');
    }else{
      var link = $(`#next-block-${channel.id}`);
      link.attr("href", "#");
      link.css('display', 'none');
    }
    if (channel.pageTokens.length > channel.tokenIndex-1 ){
      var link = $(`#prev-block-${channel.id}`);
      link.attr("href",`javascript:readMessageStore('${channel.id}', 'prev')`);
      link.css('display', 'inline');
    }else{
      var link = $(`#prev-block-${channel.id}`);
      link.attr("href", "#");
      link.css('display', 'none');
    }
    $(`#navi-${channel.id}`).show()
  }else {
    $(`#navi-${channel.id}`).hide()
  }
}

function createConversationsList(channel, totalMsg, newMsgCount, threadId){
  var html = ""
  html = `<div id='all-${channel.id}' class='recipient-item' onclick='showConversation("${channel.id}", "all-${channel.id}", "")'><div class="recipient-info">All conversations</div><div class="message-count">${totalMsg}</div></div>`
  /* // No need to highlight for the "all" convo list!
  if (newMsgCount == 0)
    html = `<div id='all-${channel.id}' class='recipient-item' onclick='showConversation("${channel.id}", "all-${channel.id}", "")'><div class="recipient-info">All conversations</div><div class="message-count">${totalMsg}</div></div>`
  else
    html = `<div id='all-${channel.id}' class='recipient-item' onclick='showConversation("${channel.id}", "all-${channel.id}", "")'><div class="recipient-info">All conversations</div><div class="new-message-count">${totalMsg}</div></div>`
  */
  for (var convoGroup of channel.messageList){
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
      name = customer.authorName
      //name += (name != "") ? ` - ${customer.authorName}` : customer.authorName
    //console.log(customer, name)
    if (convoGroup.conversations.length == 0){
        console.log("not likely")
    }else if (convoGroup.conversations.length == 1){
        name += ` (${creationTime(convoGroup.conversations[0].creationTime)})`
    }else{
        var lastMSg = convoGroup.conversations.length - 1
        //name += ` (${creationTime(convoGroup.conversations[lastMSg].creationTime)})`
        name += ` (${creationTime(convoGroup.conversations[0].creationTime)})`
    }

    html += `<div id='${convoGroup.conversationId}' class='recipient-item' onclick='showConversation("${channel.id}","${convoGroup.conversationId}", "${name}", "${threadId}")'>`
    /*
    if (avatarUri){
      console.log(avatarUri)
      //html += `<span class="avatar"><img class="avatar" src="${avatarUri}"</img></span>`
    }
    */
    var inboundCount = 0
    var outboundCount = 0
    for (var item of convoGroup.conversations){
      if (item.status == "New" || item.status == "Ignored" || item.status == "Replied")
        inboundCount++
      else
        outboundCount++
    }
    /*
    if (threadId == 0)
      html += `<span class="recipient-info">${name}</span><span class="message-count">${inboundCount}/${outboundCount}</span>`
    */
    if (convoGroup.conversationId == threadId)
      html += `<span class="recipient-info">${name}</span><span id='indicator-${convoGroup.conversationId}' class="new-message-count">${inboundCount}/${outboundCount}</span>`
    else
      html += `<span class="recipient-info">${name}</span><span id='indicator-${convoGroup.conversationId}' class="message-count">${inboundCount}/${outboundCount}</span>`
    html += "</div>"
  }

  $(`#recipient-list-${channel.id}`).html(html)
  showConversation(channel.id, channel.currentSelectedItem, name, threadId)
}

function showConversation(channelId, selectedConvo, name, threadId){
  //console.log("recipient", selectedConvo)
  //console.log("channel id", channelId)
  var channel = displayedChannels.find(o => o.id === channelId)

  $(`#${channel.currentSelectedItem}`).removeClass("active");

  $(`#${selectedConvo}`).addClass("active");
  if (selectedConvo == threadId){
    setTimeout(function(){
      $(`#indicator-${selectedConvo}`).removeClass("new-message-count");
      $(`#indicator-${selectedConvo}`).addClass("message-count");
    }, 3000)
  }
  channel.currentSelectedItem = selectedConvo

  if (channel.messageList.length){
    var html = '<div class="chat-container"><ul class="chat-box chatContainerScroll">'
    dateStr = ""
    //var totalMessage = 0
    if (selectedConvo == `all-${channelId}`){
      $(`#message-input-${channel.id}`).hide()
      conversationHeight = 50
      setElementsHeight()
      //$("#conversation-title").html(`All conversations`)
      //totalMessage = messageList.length
      channel.params.to = ""

      var maxLen = channel.messageList.length - 1
      for (var i=maxLen; i>=0; i--){
        var convoGroup = channel.messageList[i]
        var convoLen = convoGroup.conversations.length - 1
        for (var n=convoLen; n>=0; n--){
          var msg = convoGroup.conversations[n]
          if (msg.status == "New" || msg.status == "Ignored" || msg.status == "Replied"){
            channel.params.to = msg.id
          }
          html += createConversationItem(channel.id, msg, false)
        }
      }
    }else { // display selected conversation
      //$(`#${currentSelectedItem}-count`).remove()
      conversationHeight = 312
      setElementsHeight()
      //params.to = recipient //selectedRecipient
      channel.params.message = ""
      channel.params.to = ""
      $(`#message-input-${channel.id}`).show()
      var title = `<span>${name}</span>`
      //$("#conversation-title").html(title)

      var convoGroup = channel.messageList.find(o => o.conversationId === selectedConvo)
      if (!convoGroup){
        convoGroup = channel.messageList[0]
      }
      var maxLen = convoGroup.conversations.length - 1
      for (var i=maxLen; i>=0; i--){
        var msg = convoGroup.conversations[i]
        if (msg.status == "New" || msg.status == "Ignored" || msg.status == "Replied"){
          channel.params.to = msg.id
        }
        html += createConversationItem(channel.id, msg, true)
      }
      if (channel.params.to == ""){
        // disable the input for now. Should be enable for initiating a new message!
        $(`#message-input-${channel.id}`).hide()
      }else{
        $(`#message-input-${channel.id}`).show()
      }
    }
    //$("#total").html(`${totalMessage} messages`)
    html += "</ul></div>"

    $(`#conversation-${channel.id}`).html(html)
    $(`#conversation-${channel.id}`).animate({ scrollTop: $(`#conversation-${channel.id}`)[0].scrollHeight}, 100);
  }else{
    //$("#conversation-title").html("")
    $(`#conversation-${channel.id}`).html("No content")
    $(`#message-input-${channel.id}`).hide()
  }
}

function createConversationItem_period(channelId, item, conversation){
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
    /*
    if (item.avatarUri != ""){
      line += `<div class="chat-avatar"><img class="avatar" src="${item.avatarUri}"</img></div>`
    }
    */
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

function createConversationItem(channelId, item, conversation){
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
    /*
    if (item.avatarUri != ""){
      line += `<div class="chat-avatar"><img class="avatar" src="${item.avatarUri}"</img></div>`
    }
    */
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
        line += `<a href="#" class="chat-avatar" onclick="getAnswer('${channelId}', '${msg}')"><img src="/img/bot.png" style="width: 30px; height: 35px" /></a>`
    }
  }

  line += '</li>'
  return line
}

function getAnswer(channelId, msg){
  //$("#send-text").val(msg)
  //return
    var bodyParams = {
      message: msg
    }
    var url = 'get-answer'
    var posting = $.post( url, bodyParams );
    posting.done(function( res ) {
      if (res.status == "ok") {
        sendTextMessage(channelId, res.message)
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
