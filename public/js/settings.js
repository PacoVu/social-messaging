var channels = []
function init() {
  setElementsHeight()
  channels = JSON.parse(window.channels)
  showChannelInfo()
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()

  $("#content").height(swindow)
  //$("#menu-pane").height(swindow)
  //$("#control-list-col").height(swindow)

  //$("#recipient-list").height(swindow - ($("#col2-header").outerHeight(true) + 120))
  //$("#conversation").height(swindow - ($("#conversation-header").outerHeight(true) + conversationHeight))
}

function showChannelInfo(){
  var channelId = $("#connected-channels").val()
  var channel = channels.find(o => o.id == channelId)
  if (channel){
    console.log(channel)
    var html = `<div><label class="label-input">Name:</label>${channel.name}</div>`
    html += `<div><label class="label-input">Id:</label>${channel.id}</div>`
    html += `<div><label class="label-input">Type:</label>${channel.channelType}</div>`
    html += `<div><label class="label-input">Avatar URL:</label>${channel.avatarUri}</div>`
    if (channel.channelType == "WhatsApp")
      html += `<div><label class="label-input">Phone number:</label>${channel.contactId}</div>`
    else if (channel.channelType == "Apple")
      html += `<div><label class="label-input">Apple Id:</label>${channel.contactId}</div>`
    $("#channel-info").html(html)
    $("#display-channel").show()
  }else{
    $("#display-channel").hide()
  }
}

function unregisterSelectedChannel(){
  var channelId = $("#connected-channels").val()
  var channel = channels.find(o => o.id == channelId)
  var url = `unregister-channel?id=${channelId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      alert("Channel unregistered.")
      window.location.href = "/settings"
    }else{
      _alert(res.message, "Error")
    }
  });
}
