var OAuthCode = function(authUri, redirectUri) {
    this.loginPopup  = function() {
      this.loginPopupUri(authUri, redirectUri);
    }
    this.loginPopupUri  = function(authUri, redirectUri) {
      var win         = window.open(authUri, 'windowname1', 'width=800, height=600');
      var pollOAuth   = window.setInterval(function() {
        try {
          //console.log(win.document.URL)
          if ( win.document.URL.indexOf(redirectUri) != -1 ||
               win.document.URL.indexOf('highvolumesms.com') != -1 ) {
            window.clearInterval(pollOAuth);
            win.close();
            window.setTimeout(function() {
              window.location.href = "main"
            }, 100)
          }
        } catch(e) {
          console.log(e)
      }
    }, 100);
  }
}

function login() {
  var oauth = new OAuthCode(window.RC_AUTHORIZE_URI, window.RC_APP_REDIRECT_URL);
  oauth.loginPopup()
}

function chooseEnvironment(){
  window.location.href = "login"
}
