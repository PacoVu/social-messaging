var timeOffset = 0
var campaignList = undefined
var analyticsData = undefined
//var failureAnalysis = undefined
var pageToken = undefined
var pollingTimer = undefined

function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "analytics"
  $(`#${mainMenuItem}`).addClass("active")

  timeOffset = new Date().getTimezoneOffset()*60000;

  $( "#fromdatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});

  var past90Days = new Date().getTime() - (86400000 * 90)

  $( "#fromdatepicker" ).datepicker('setDate', new Date(past90Days));
  $( "#todatepicker" ).datepicker('setDate', new Date());
}

function onloaded(){

}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  $("#control-list-col").height(swindow)

}

function changeAnalyticsBase(elm){
  var option = $(elm).val()
  if (option == 'date-range'){
    $("#date-range").show()
    $("#campaign-range").hide()
  }else{
    $("#campaign-range").show()
    $("#date-range").hide()
    if (campaignList == undefined)
      readCampaigns()
  }
}


function readMessageStore(){
  var dateFromStr = ""
  var timestamp = new Date().getTime()
  var dateToStr = new Date(timestamp).toISOString()
  var tempDate = new Date($("#fromdatepicker").val() + "T00:00:00.001Z")
  var tempTime = tempDate.getTime()
  dateFromStr = new Date(tempTime).toISOString()

  tempDate = new Date($("#todatepicker").val() + "T23:59:59.999Z")
  tempTime = tempDate.getTime()
  dateToStr = new Date(tempTime).toISOString()
  var fromChannels = $('#my-channels').val()
  var configs = {
    mode: 'date',
    dateFrom: dateFromStr,
    dateTo: dateToStr,
    timeOffset: timeOffset,
    fromChannels: fromChannels //`["${fromChannels}"]`
  }
  $("#processing").show()
  $("#options-bar").hide()
  $("#by_direction").html("")
  $("#by_status").html("")
  $("#by_cost").html("")
  $("#statistics-title").html("")
  $("#statistics").html("")
  $("#analysis-title").html("")
  $("#analysis").html("")
  $("#graph-column").html("")

  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#total-by-direction").html(readingAni)
  //$("#total-by-cost").html(readingAni)
  //$("#total-by-status").html(readingAni)
  $("#downloads").hide()
  var url = "create-messaging-analytics"
  var posting = $.post( url, configs );
  posting.done(function( res ) {
    if (res.status == "ok") {
      $("#total-title").html(`Messaging statistics between ${$("#fromdatepicker").val()} and ${$("#todatepicker").val()}`)
      pollingTimer = window.setTimeout(function(){
          pollAnalyticsResult()
      },3000)
    }else if (res.status == "error"){
      $("#processing").hide()
      $("#by_direction").html("")
      _alert(res.message)
    }else{
      $("#processing").hide()
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

function pollAnalyticsResult(){
  var url = "poll-analytics-result"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#options-bar").show()
      analyticsData = res.result
      //analyticsData.failureAnalysis = res.failureAnalysis
      if (res.result.task != "Initiated")
        displayAnalytics()
      if (res.result.task == "Processing"){
        pollingTimer = window.setTimeout(function(){
          pollAnalyticsResult()
        },5000)
      }else{
        //if (res.result.task == "Completed")
        //  $("#downloads").show()
        $("#processing").hide()
        displayAnalytics()
      }
    }else{
      $("#processing").hide()
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

var mode = "graphics"
function switchDisplayMode(){
  if (mode == "graphics"){
    $("#mode-icon").attr("src", "./img/graph.png")
    $("#mode-label").html(" Graphics view")
    mode = "table"
  }else{
    $("#mode-icon").attr("src", "./img/table.png")
    $("#mode-label").html(" Table view")
    mode = "graphics"
  }
  displayAnalytics()
}

function displayAnalytics(){
  if (mode == "graphics"){
    displayAnalyticsTotal()
  }else{
    displayAnalyticsTotalTable()
  }

  $("#sub-category").show()
  $("#graphs").show()
  displayAnalyticsType()
}

function displayAnalyticsType(){
  var breakout = $("#display").val()
  if (mode == "graphics"){
    displayMessageDirection(breakout)
  }else { // table
    displayMessageDirectionTable(breakout)
  }
}

function displayAnalyticsTotal(){
  var direction_params = [[ 'Direction', '# messages', { role: "style" } ]];

  var item = [ "Outbound", analyticsData.outboundCount, '#178006' ]
  direction_params.push(item)
  item = [ "Inbound", analyticsData.inboundCount, '#1126ba']
  direction_params.push(item)

  item = [ "Total", analyticsData.outboundCount + analyticsData.inboundCount, '#03918f' ]
  direction_params.push(item)

  drawColumnChart(direction_params, "total-by-direction", '# Messages by direction', "# Messages")
}

function displayAnalyticsTotalTable(){
  var byDirection = `<div class='analytics-header'># Messages by direction</div><table class='analytics-table'>`
  byDirection += "<tr><td class='table-label'>Direction</td><td class='table-label'># Messages</td></tr>"
  byDirection += `<tr><td class='table-label'>Inbound</td><td>${formatNumber(analyticsData.inboundCount)}</td></tr>`
  byDirection += `<tr><td class='table-label'>Outbound</td><td>${formatNumber(analyticsData.outboundCount)}</td></tr>`
  byDirection += `<tr><td class='table-label'>Total</td><td>${formatNumber(analyticsData.outboundCount + analyticsData.inboundCount)}</td></tr></table>`
/*
  var byStatus = `<div class='analytics-header'># Messages by status</div><table class='analytics-table'>`
  byStatus += "<tr><td class='table-label'>Status</td><td class='table-label'># Messages</td></tr>"
  byStatus += `<tr><td class='table-label'>Delivered</td><td>${formatNumber(analyticsData.deliveredCount)}</td></tr>`
  var totalFailed = analyticsData.deliveryFailedCount + analyticsData.sendingFailedCount
  byStatus += `<tr><td class='table-label'>Failed</td><td class='bad-data'>${formatNumber(totalFailed)}</td></tr>`
  byStatus += `<tr><td class=''>&nbsp;&nbsp;- Sending failed</td><td class='bad-data'>${formatNumber(analyticsData.sendingFailedCount)}</td></tr>`
  byStatus += `<tr><td class=''>&nbsp;&nbsp;- Delivery failed</td><td class='bad-data'>${formatNumber(analyticsData.deliveryFailedCount)}</td></tr></table>`


  var byCost = `<div class='analytics-header'>Cost by direction</div><table class='analytics-table'>`
  byCost += "<tr><td class='table-label'>Direction</td><td class='table-label'>USD</td></tr>"
  var totalCost = analyticsData.sentMsgCost + analyticsData.receivedMsgCost
  byCost += `<tr><td class='table-label'>Inbound</td><td>${formatNumber(analyticsData.receivedMsgCost.toFixed(2))}</td></tr>`
  byCost += `<tr><td class='table-label'>Outbound</td><td>${formatNumber(analyticsData.sentMsgCost.toFixed(2))}</td></tr>`
  byCost += `<tr><td class='table-label'>Total</td><td>${formatNumber(totalCost.toFixed(2))}</td></tr></table>`
*/
  $("#total-by-direction").html(byDirection)
  //$("#total-by-cost").html(byCost)
  //$("#total-by-status").html(byStatus)
}

function writeTitle(type, title){
  $(`#${type}`).html(title)
}

function formatFloatNumber(number){
  if (number >= 100.0)
    return number.toFixed(0)
  else if (number >= 10)
    return number.toFixed(1)
  else
    return number.toFixed(2)
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
function convertMonth(month){
  var year_month = month.split("-")
  var monthStr = months[parseInt(year_month[1])-1]
  monthStr += ` ${year_month[0].substring(2, 4)}`
  return monthStr
}

function showRateInfo(type){
  var infoText = [
    "<p>Response rate is the percentage ratio of inbound messages over successfully delivered outbound messages. High response rate is the good health of your \
    high volume SMS phone number. Especially, when you start using your phone number for the first time, high response rate would \
    help warm up your phone number reputation. As a result, it would help prevent mobile carriers from blocking your text messages.</p>\
    <br><b>Best practices to increase and maintain high response rate:</b>\
    <ul><li>Start your text messaging campaign by sending a brief message to ask if your customers would like to learn more about your sale or promo. \
    E.g. 'Reply YES for more info'. Treat the first message as an opt-in or opt-out choice for your customer.</li>\
    <li>Break a lengthy text message into multi-section messages, then send a brief message with response choices to receive the next messages.</li>\
    <li>If you send text messages to your customers repeatedly over a long period of time without requesting for response, send a survey message to \
    the customers periodically, to ask if they still want to receive your text messages.</li></ul>",
    "<p>Delivery rate is the percentage ratio of successfully delivered message over delivery failed messages. The higher delivery rate the better!</p>\
    <br><b>Here is a few tips for how to increase the delivery rate:</b>\
    <ul><li>Make sure your recipient phone number is in a correct format (E.164) with a country code followed by the area code and the local number without space, bracket or hyphen symbols.</li>\
    <li>Remove landline and invalid phone numbers from your recipient list as much as you can.</li>\
    <li>Download your campaign's report, copy the recipient phone number from any failed messages and remove them from your recipient list after sending every campaign.</li>\
    <li>Regularly, read opted-out numbers and remove them from your recipient list.</li>",
    "<p>Cost efficiency rate is calculated from the cost of successfully delivered messages and the cost of undeliverable messages. Keeping the cost \
    efficiency at a high rate will help you maximize the value of your text messaging spending.</p>\
    <br><b>Here is a few tips for how to increase cost efficiency rate:</b>\
    <ul><li>Regularly, read opted-out numbers and remove them from your recipient list.</li>\
    <li>Learn from your previous campaigns to avoid or to minimize the numbers of 'DeliveryFailed' incidents by modifying your message content if the message was flagged as spam content, or removing those recipients' phone number from the recipient list of your next campaigns.</li></ul>"
  ]
  var title = [
    "Response rate",
    "Delivery rate",
    "Cost efficiency",
  ]
  _alert(infoText[type], title[type])
}

function displayMessageDirection(breakout){
  var colors = ['#178006','#f04b3b','#1126ba']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var direction_params = [['Month', 'Success Outbound', 'Failed Outbound','Inbound']]
    var response_params = [['Month', 'Response rate (Success Outbound / Inbound)']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      //var item = [ convertMonth(m.month), m.outboundCount, m.inboundCount ]
      var item = [ convertMonth(m.month), m.deliveredCount, m.sendingFailedCount, m.inboundCount ]
      direction_params.push(item)
      var rate = 0.0
      if (m.deliveredCount > 0)
        rate = (m.deliveredCount/m.inboundCount) * 100
      item = [convertMonth(m.month), parseFloat(formatFloatNumber(rate))]
      response_params.push(item)
    }
    writeTitle('statistics-title', '# Messages by direction')
    drawComboChart(direction_params, "statistics", 'Messages by direction (per month)', 'Messages', 'Month', colors)
    writeTitle('analysis-title', 'Response rate per month')
    drawComboChart(response_params, "analysis", 'Response rate', '%', 'Month', color)
  }else if (breakout == "bychannel"){
    var channels = analyticsData.channels
    var direction_params = [[ 'Channel', 'Success Outbound', 'Failed Outbound', 'Inbound' ]];
    var response_params = [['Month', 'Response rate (Success Outbound / Inbound)']];
    for (var channel of channels) {
      var channelName = channel.channelName
      //var item = [ serviceNumber, m.outboundCount, m.inboundCount ]
      var item = [ channelName, channel.deliveredCount, channel.sendingFailedCount, channel.inboundCount ]
      direction_params.push(item)
      var rate = 0.0
      if (channel.deliveredCount > 0)
        rate = (channel.deliveredCount/channel.inboundCount) * 100
      item = [channelName, parseFloat(formatFloatNumber(rate))]
      response_params.push(item)
    }
    writeTitle('statistics-title', '# Messages by direction')
    drawComboChart(direction_params, "statistics", 'Messages by direction', 'Messages', 'Channel', colors)
    writeTitle('analysis-title', 'Response rate')
    drawComboChart(response_params, "analysis", 'Response rate', '%', 'Channel', color)
  }
}

function displayMessageDirectionTable(breakout){
  writeTitle('analysis-title', '')
  var byDirection = "<table class='analytics-table'>"
  var dHeader = ""
  var dReceived = "<tr><td class='table-label'>Inbound messages</td>"
  var dSent = "<tr><td class='table-label'>Outbound messages</td>"
  var dSentFailed = "<tr><td class='table-label'>Outbound Failed messages</td>"
  var dTotal = "<tr><td class='table-label'>Total messages</td>"
  var dRate = "<tr><td class='table-label'>Response rate</td>"

  if (breakout == "monthly"){
    dHeader = "<tr><td class='table-label'>Month</td>"
    var monthlyData = analyticsData.months
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      dHeader += `<td class='table-data'>${convertMonth(m.month)}</td>`
      // direction
      dReceived += `<td>${m.inboundCount}</td>`
      dSent += `<td>${m.outboundCount}</td>`
      dSentFailed += `<td>${m.sendingFailedCount}</td>`
      dTotal += `<td>${m.outboundCount + m.inboundCount}</td>`
      var rate = 0.0
      if (m.outboundCount > 0)
        rate = (m.outboundCount/m.inboundCount) * 100
      dRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Messages by direction per month')
  }else if (breakout == "bychannel"){
    var dHeader = "<tr><td class='table-label'>Channel</td>"

    for (var channel of analyticsData.channels) {
      dHeader += `<td class='table-data'>${channel.channelName}</td>`
      // direction
      dReceived += `<td>${channel.inboundCount}</td>`
      dSent += `<td>${channel.outboundCount}</td>`
      dSentFailed += `<td>${channel.sendingFailedCount}</td>`
      dTotal += `<td>${channel.outboundCount + channel.inboundCount}</td>`
      var rate = 0.0
      if (channel.outboundCount > 0)
        rate = (channel.outboundCount/channel.inboundCount) * 100
      dRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Messages by direction per channel')
  }

  byDirection += `${dHeader}</tr>`
  byDirection += `${dReceived}</tr>`
  byDirection += `${dSent}</tr>`
  byDirection += `${dSentFailed}</tr>`
  byDirection += `${dTotal}</tr>`
  byDirection += `${dRate}</tr>`
  byDirection += "</table>"

  $("#statistics").html(byDirection)
  $("#analysis").html("")
}
/*
function displayMessageStatus(breakout){
  var colors = ['#0770a8', '#f04b3b']
  var color = ['#178006']
  if (breakout == "monthly"){
    var monthlyData = analyticsData.months
    var status_params = [['Month', 'Delivered', 'Failed']]
    var efficiency_params = [['Month', 'Delivery rate']];
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      var item = [convertMonth(m.month), m.deliveredCount, m.deliveryFailedCount + m.sendingFailedCount]
      status_params.push(item)
      var rate = 0.0
      var total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
      if (total > 0)
        rate = (m.deliveredCount / total) * 100
      item = [convertMonth(m.month), parseFloat(formatFloatNumber(rate))]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', '# Outbound messages by status (per month)')
    drawComboChart(status_params, "statistics", 'Outbound messages by status (per month)', 'Messages', 'Month', colors)
    writeTitle('analysis-title', 'Delivery rate (per month) <a href="#" onclick="showRateInfo(1);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Delivery rate (per month)', '%', 'Month', color)
  }else if (breakout == "bychannel"){
    var serviceNumberData = analyticsData.phoneNumbers
    var status_params = [[ 'Service Number', 'Delivered', 'Failed' ]];
    var efficiency_params = [['service Number', 'Delivery rate']];
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      var item = [ serviceNumber, m.deliveredCount, m.deliveryFailedCount + m.sendingFailedCount ]
      status_params.push(item)
      var rate = 0.0
      var total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
      if (total > 0)
        rate = (m.deliveredCount / total) * 100
      item = [serviceNumber, parseFloat(formatFloatNumber(rate))]
      efficiency_params.push(item)
    }
    writeTitle('statistics-title', '# Outbound messages by status (per service number)')
    drawComboChart(status_params, "statistics", 'Outbound messages by status (per service number)', 'Messages', 'Phone Number', colors)
    writeTitle('analysis-title', 'Delivery rate (per service number) <a href="#" onclick="showRateInfo(1);return false;">&#9432;</a>')
    drawComboChart(efficiency_params, "analysis", 'Delivery rate (per service number)', '%', 'Phone Number', color)
  }
}

function displayMessageStatusTable(breakout){
  writeTitle('analysis-title', '')
  var dHeader = ""
  var byStatus = "<table class='analytics-table'>"
  var sSucceeded = "<tr><td class='table-label'>Delivered</td>"
  var sFailed = "<tr><td class='table-label'>Failed</td>"
  var sSucceededRate = "<tr><td class='table-label'>Delivery rate</td>"

  if (breakout == "monthly"){
    dHeader = "<tr><td class='table-label'>Month</td>"
    var monthlyData = analyticsData.months
    for (var i=monthlyData.length-1; i>=0; i--) {
      var m =  monthlyData[i]
      dHeader += `<td class='table-data'>${convertMonth(m.month)}</td>`
      sSucceeded += `<td>${m.deliveredCount}</td>`
      var totalFailedCount = m.sendingFailedCount + m.deliveryFailedCount
      sFailed += `<td class='bad-data'>${totalFailedCount}</td>`
      var total = m.deliveredCount + totalFailedCount
      var rate = (m.deliveredCount / total) * 100
      sSuccessRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Outbound messages by status (per month)')
  }else if (breakout == "bychannel"){
    dHeader = "<tr><td class='table-label'>Service Number</td>"
    var serviceNumberData = analyticsData.phoneNumbers
    for (var m of serviceNumberData) {
      var serviceNumber = formatPhoneNumber(m.number,false)
      dHeader += `<td class='table-data'>${serviceNumber}</td>`
      sSucceeded += `<td>${m.deliveredCount}</td>`
      var totalFailedCount = m.sendingFailedCount + m.deliveryFailedCount
      sFailed += `<td class='bad-data'>${totalFailedCount}</td>`
      var total = m.deliveredCount + totalFailedCount
      var rate = (m.deliveredCount / total) * 100
      sSuccessRate += `<td>${formatFloatNumber(rate)} %</td>`
    }
    writeTitle('statistics-title', '# Outbound messages by status (per service number)')
  }

  byStatus += `${dHeader}</tr>`
  byStatus += `${sSucceeded}</tr>`
  byStatus += `${sFailed}</tr>`
  byStatus += `${sSuccessRate}</tr>`
  byStatus += "</table>"

  $("#statistics").html(byStatus)
  $("#analysis").html("")
}
*/

function drawComboChart(params, graph, title, vTitle, hTitle, colors, format){
  var data = google.visualization.arrayToDataTable(params);
  var view = new google.visualization.DataView(data);
  var columns = [];
  for (var i = 0; i <= colors.length; i++) {
      if (i > 0) {
          columns.push(i);
          columns.push({
              calc: "stringify",
              sourceColumn: i,
              type: "string",
              role: "annotation"
          });

      } else {
          columns.push(i);
      }
  }

  view.setColumns(columns);
  var options = {
          //title : title,
          width: "98%",
          height: 210,
          //vAxis: {minValue: 0, title: `${vTitle}`},{vAxis: {format:'#%'}
          //hAxis: {title: `${hTitle}`, format: 0},
          vAxis: { minValue: 0, title: `${vTitle}` },
          hAxis: {minValue: 0, format: 0},
          seriesType: 'bars',
          bar: {groupWidth: "60%"},
          legend: { position: "top" },
          colors: colors //['#2280c9','#2f95a5', '#f04b3b']
          //series: {3: {type: 'line'}}
        };

  var chart = new google.visualization.ComboChart(document.getElementById(graph));
  chart.draw(view, options);
}

function drawColumnChart(params, graph, title, vTitle){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
                    { calc: "stringify",
                       sourceColumn: 1,
                       type: "string",
                       role: "annotation"
                    },
                    2]);

    var options = {
      title: title,
      vAxis: {minValue: 0, title: `${vTitle}`},
      //hAxis: {format: 0},
      width: 320,
      height: 210,
      bar: {groupWidth: "80%"},
      legend: { position: "none" },
    };

    var chart = new google.visualization.ColumnChart(document.getElementById(graph));
    chart.draw(view, options);
    /*
    google.visualization.events.addListener(chart, 'select', selectHandler);
    function selectHandler() {
      var selection = chart.getSelection();

      var selectedType = -1
      for (var i = 0; i < selection.length; i++) {
        var item = selection[i];
        if (item.row != null) {
          selectedType = item.row
        }
      }
      var message = ""
      if (selectedType == 0){
        message = "<div>Suspected spam content</div>"
        for (var c of analyticsData.outboundFailureTypes.content.messages){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 1){
        message = "<div>Invalid recipient numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.invalidRecipientNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 2){
        message = "<div>Blocked service numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.blockedSenderNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 3){
        message = "<div>Opted out numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.optoutNumbers){
          message += `<div>${c}</div>`
        }
      }else if (selectedType == 4){
        message = "<div>Other unknown numbers</div>"
        for (var c of analyticsData.outboundFailureTypes.others.messages){
          message += `<div>${c}</div>`
        }
      }
      $("#text-column").html(message)
    }
    */
}

function drawPieChart(params, graph, title, colors, slice){
  var data = google.visualization.arrayToDataTable(params);
  //var view = new google.visualization.DataView(data);
  var slices = {}
  slices[slice] = {offset: 0.4}

  var options = {
    title: title,
    width: 280,
    height: 280,
    colors: colors,
    backgroundColor: 'transparent',
    chartArea:{left:0,top:20,bottom:0,width:'100%',height:'100%'},
    legend: {
      position: "right",
      maxLines: 2,
      textStyle: {
        fontSize: 10

      }
    },
    pieSliceText: 'value',
    //pieStartAngle: 90,
    //pieHole: 0.5,
    sliceVisibilityThreshold: 0.0001,
    slices: slices
  };

  var element = document.getElementById(graph)
  var chart = new google.visualization.PieChart(element);
  chart.draw(data, options);
  /*
  google.visualization.events.addListener(chart, 'select', selectHandler);
  function selectHandler() {
    //alert(chart.getSelection()[0])
    var selection = chart.getSelection();
    var selectedType = -1
    for (var i = 0; i < selection.length; i++) {
      var item = selection[i];
      if (item.row != null) {
        selectedType = item.row
      }
    }
    var message = ""
    if (selectedType == 0){
      message = "<div class='breakout'>Suspected spam content</div>"
      for (var c of analyticsData.outboundFailureTypes.content.messages){
        message += `<div class='block_space'>${c}</div>`
      }
    }else if (selectedType == 1){
      message = "<div class='breakout'>Invalid recipient numbers</div>"
      message += `<p class='block_space'>Mobile carriers could not deliver your messages to these recipients. You should correct the numbers or remove them from the recipient list to improve the cost efficiency.</p>`
    }else if (selectedType == 2){
      message = "<div class='breakout'>Opted out recipients</div>"
      message += `<p class='block_space'>These recipients have opted out from your campaign. Sending messages to opted-out recipients is violating the CTIA regulation and as a result, mobile carrier may block your service number permanently. You must remove them from the recipient list to avoid getting low sending reputation and panelty.</p>`
    }else if (selectedType == 3){
      message = "<div class='breakout'>Blocked service numbers</div>"
      for (var c of analyticsData.outboundFailureTypes.blockedSenderNumbers){
        message += `<div class='block_space'>${c}</div>`
      }
    }else if (selectedType == 4){
      message = "<div class='breakout'>Rejected phone numbers</div>"
      message += `<p class='block_space'>We detected these phone numbers either are invalid or do not exist. You should correct the numbers or remove them from the recipient list to improve the sending efficiency.</p>`
    }else if (selectedType == 5){
      message = "<div class='breakout'>Other unknown numbers</div>"
      for (var c of analyticsData.outboundFailureTypes.others.messages){
        message += `<div class='block_space'>${c}</div>`
      }
    }

    $("#text-column").html(message)
  }
  */
}

function drawScatterChart(params, graph, title, vTitle, hTitle) {
    var data = google.visualization.arrayToDataTable(params);
    var options = {
      title: title,
      width: "100%",
      height: 220,
      vAxis: {title: `${vTitle}`, minValue: 0},
      hAxis: {title: `${hTitle}`, minValue: 0, maxValue: 23, format: 0},
      viewWindow: {minValue: 0, maxValue: 23},
      pointShape: { type: 'triangle', rotation: 180 },
      colors:['#2280c9','#2f95a5', '#f04b3b'],
      legend: {
        position: "right"
      }
    };

    var element = document.getElementById(graph)
    var chart = new google.visualization.LineChart(element);
    chart.draw(data, options);
}


function downloadAnalytics(){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var fileName = `${$("#fromdatepicker").val()}-${$("#todatepicker").val()}`
  var url = `download-analytics?timeOffset=${timeOffset}&fileName=${fileName}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function logout(){
  window.location.href = "index?n=1"
}
