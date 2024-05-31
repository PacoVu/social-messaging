function openReplyForm(toContentId, fromNumber){
  var message = $('#send_reply_form');
  setTimeout(function (){
    $("#text-message").focus()
  }, 1000);
  $('#send_reply_form').on('shown.bs.modal', function () {
    ;
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Reply to: ${toContentId}</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-reply').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send',
        cssClass: 'btn btn-primary',

        action: function(dialog) {
          var params = {
            from: fromNumber,
            to: toNumber,
            message: $("#text-message").val()
          }
          if (params.message == ""){
            $("#text-message").focus()
            return _alert("Please enter text message!")
          }
          var url = "send-message"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              /*
              window.setTimeout(function(){
                readMessageStore(pageToken)
              },2000)
              */
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}

function addToRecipient(elm){
  $("#to-new-number").val($(elm).val())
}

function showSelectedTemplate(e){
  let template = {
            "type": "body",
            "parameters": [
              {
                "type": "text",
                "text": "Paco"
              },
              {
                "type": "text",
                "text": "Plumbing maintenance"
              }
            ],
            "message": "Hello {{1}}, your order for {{2}} is confirmed and will be billed as per your billing cycle. Please call back for any changes."
          }

    var mainContainer = $("#structured-content")
    var i1 = $('<label>', {text : "Name: "})
      //.css('style', "display: inline; width: 100px")
      .appendTo(mainContainer);

    $('<input id="input-1">')
        //.css('style', "display: inline; width: 120px;")
        .addClass('form-control')
        .attr('onkeyup', `composeSampleMessage('${template.message}')`)
        .appendTo(i1);

    var i2 = $('<label>', {text : "Message: "})
      //.css('style', "display: inline; width: 100px")
      .appendTo(mainContainer);

    $('<input id="input-2">')
      //.css('style', "display: inline; width: 150px;")
      .addClass('form-control')
      .attr('onkeyup', `composeSampleMessage('${template.message}')`)
      .appendTo(i2);

    $('<div>', {text : "Sample text: "})
      .appendTo(mainContainer);

    $('<div id="composed-message">')
      .appendTo(mainContainer);
}

function composeSampleMessage(templateMessage){
  var sampleText = templateMessage.replace('{{1}}', $("#input-1").val())
  sampleText = sampleText.replace('{{2}}', $("#input-2").val())
  $('#composed-message').html(sampleText)
}

function openInitiateWAMessage(channelId, channelName, contactsList){
  $("#structured-content").empty()
  var testTemplatesName = [ "account_usage_info", "none-existing-template" ]
  var testTemplateLang = [ "en", "fr", "es" ]
  $("#contacts-block").show()
  if (contactsList.length > 0){
    if ($("#contact-list").val() == ""){
      var contacts = ""
      for (var contact of contactsList){
        if (contact.type == "Phone"){
          contacts += `<option value="${contact.mobilePhone}">${contact.displayName}</option>`
        }
      }
    }
    $("#contact-list").html(contacts)
    $('#contact-list').selectpicker('refresh');
  }
  var templates = ""
  for (var template of testTemplatesName){
    templates += `<option value="${template}">${template}</option>`
  }
  $("#template-list").html(templates)
  $('#template-list').selectpicker('refresh');
  var languages = ""
  for (var language of testTemplateLang){
    languages += `<option value="${language}">${language}</option>`
  }
  $("#language-list").html(languages)
  $('#language-list').selectpicker('refresh');

  var message = $('#send_new_wa_form');
  setTimeout(function (){
    $("#to-new-number").focus()
  }, 1000);
  $('#send_new_wa-form').on('shown.bs.modal', function () {
    ;
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Send new message from ${channelName}</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-new-conversation').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send',
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          var components = [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: $("#input-1").val()
                },
                {
                  type: "text",
                  text: $("#input-2").val()
                }
              ]
            }
          ]
          var params = {
            channelId: channelId,
            to: $("#to-new-number").val(),
            templateName: $("#template-list").val(),
            templateLanguage: $("#language-list").val(),
            components: JSON.stringify(components)
          }
          if (params.to == ""){
            $("#to-new-number").focus()
            return _alert("Please enter a recipient phone number!")
          }
          if (params.templateName == ""){
            $("#template-list").focus()
            return _alert("Please select a template!")
          }
          if (params.templateLanguage == ""){
            $("#language-list").focus()
            return _alert("Please select a language for this template!")
          }

          var url = "initiate-wa-conversation"
          $("#structured-content").empty()
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              _alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}

function openInitiateFBMessage(channelId, channelName){
  var message = $('#send_new_fb_form');

  $('#send_new_fb_form').on('shown.bs.modal', function () {
    ;
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Send new message to ${channelName}</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-new-conversation').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send',
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          var params = {
            channelId: channelId,
            message: $("#new-fb-text-message").val()
          }

          if (params.message == ""){
            $("#newfb--text-message").focus()
            return _alert("Please enter text message!")
          }
          var url = "initiate-fb-conversation"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              var newConvo = {
                conversationId: res.message.threadId,
                conversations: [res.message]
              }
              messageList.unshift(newConvo)
              currentSelectedItem = newConvo.conversationId
              checkSendMessageStatus(res.message.id)
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              _alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}

function openChannelRegistration(){
  var message = $('#create_channel_form');

  $('#create_channel_form').on('shown.bs.modal', function () {
    ;
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Register a new channel</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-new-channel').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Submit',
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          var params = {
            channelType: $("#all-channels").val(),
            name: $("#channel-name").val(),
            id: $("#channel-id").val(),
            contactId: $("#channel-number").val(),
            avatarUri: $("#channel-avatar").val()
          }

          if (params.name == ""){
            $("#channel-name").focus()
            return _alert("Please enter a channel name!")
          }

          if (params.sourceId == ""){
            $("#channel-id").focus()
            return _alert("Please enter a channel id!")
          }

          var url = "register-new-channel"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              _alert("New channel registered successfully")
              //dialog.close();
              window.location.href = "/settings"
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              _alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}
