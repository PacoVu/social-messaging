var querystring = require('querystring')
var https = require('https')
var fs = require('fs')
require('dotenv').load();

function ChatGPT() {

}

ChatGPT.prototype = {
    get: async function(endpoint, params=null) {
      return new Promise((resolve, reject) => {
        var url = process.env.GPT_SERVER_URL
        if (params != null)
          endpoint += "?" + querystring.stringify(params)
        //console.log("endpoint", endpoint)
        var headers = {
          'Content-type' : 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.GPT_API_KEY}`
        }

        var options = {host: url, path: endpoint, method: 'GET', headers: headers};
        if (params != null)
          endpoint += "?" + querystring.stringify(params)

        var get_req = https.get(options, function(res) {
            var response = ""
            res.on('data', function (chunk) {
              response += chunk
            }).on("end", function(){
              if (res.statusCode >= 200 && res.statusCode <= 204){
                resolve (response)
              }else{
                reject (response)
              }
            });
          }).on('error', function(e) {
            reject (e)
          });
      })
    },
    post: async function(endpoint, params=null, callback=null) {
      return new Promise((resolve, reject) => {
        var url = process.env.GPT_SERVER_URL //'apidocs.cloud.answerhub.com'

        var body = ""
        if (params != null){
          body = JSON.stringify(params)
        }

        var headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          //'OpenAI-Beta': 'assistants=v1',
          'Authorization': `Bearer ${process.env.GPT_API_KEY}`
        }

        var options = {host: url, path: endpoint, method: 'POST', headers: headers};

        var post_req = https.request(options, function(res) {
            var response = ""
            res.on('data', function (chunk) {
              response += chunk
            }).on("end", function(){
              if (res.statusCode >= 200 && res.statusCode <= 204){
                resolve (response)
              }else {
                console.log('headers:', res.headers);
                reject (response)
              }
            });
          }).on('error', function (e) {
            console.log(e)
            reject (e.message)
          })
          if (body != "")
          post_req.write(body);
          post_req.end();
      })
    }
}

module.exports = ChatGPT;
