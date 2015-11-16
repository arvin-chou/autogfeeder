var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var _request = require("request");

var SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';
//var q = process.env.q || ""; 

exports.accessInbox = function(q){
  _accessInbox(q);
};

// Load client secrets from a local file.
_accessInbox = function(q){
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Gmail API.
    //authorize(JSON.parse(content), listLabels);
    authorize(JSON.parse(content), function(auth){
      //listThreads(auth, "me", "Activate your Email Subscription to: ", console.log);
      //console.log(q, "q");
      listThreads(auth, "me", q, console.log);
    });
  });
};

process.argv.forEach(function (val, index, array){
  if (-1 != val.indexOf("q=")) {
    _accessInbox(val.split("q=")[1]);
  }
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Get Message with given ID.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} messageId ID of Message to get.
 * @param  {Function} callback Function to call when the request is complete.
 */
function getMessage(userId, auth, messageId, callback) {
  var gmail = google.gmail('v1'),
  request = gmail.users.messages.get,
  hdr = {
    auth: auth,
    'userId': userId,
    'id': messageId
  };
  request(hdr, callback);
}

/**
 * Get Thread with given ID.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} threadId ID of Thread to get.
 * @param  {Function} callback Function to call when the request is complete.
 */
function getThread(userId, auth, threadId, callback) {
  var gmail = google.gmail('v1'),
  request = gmail.users.threads.get,
  hdr = {
    auth: auth,
    'userId': userId,
    'id': threadId
  };
  request(hdr, callback);
}

/**
 * Retrieve Threads in the user's mailbox matching query.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} query String used to filter the Threads listed.
 * @param  {Function} callback Function to call when the request is complete.
 */
function listThreads(auth, userId, query, callback) {
  var gmail = google.gmail('v1'),
  request = gmail.users.threads.list;
  hdr = {
    auth: auth,
    'userId': userId,
    'q': query
  };

  var getPageOfThreads = function(request, hdr, result) {
    request(hdr, function (err, resp) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      result = result.concat(resp.threads);

      //console.log("resp", resp);
      //console.log("result", result);
      if (!result[0]) {
        console.log("query '", query, "' empty, 81");
        return false;
      }
      getMessage(userId, auth, result[0].id, function(err, resp) {
        console.log("snippet:", resp.snippet);
        //console.log("resp", resp);
        //console.log("resp", new Buffer(resp.payload.body.data, 'base64').toString("UTF-8"));
        //console.log("resp", resp.messages[0].payload.parts[1].body);
        //console.log("resp", body.split("https://feedburner.google.com")[1].split("\r\n\r\n"));
        var body = new Buffer(resp.payload.body.data, 'base64').toString("UTF-8"),
        //'/fb/a/mailconfirm?k=dX0vkkTFvt1NVfm8VfWjDIeq74c'
        host = "https://feedburner.google.com",
        mailconfirm = body.split(host)[1].split("\r\n\r\n")[0];

        _request.get({
          url: host + mailconfirm
        }, function (error, httpResponse, body) {
            if (-1 === body.indexOf("Email Subscription Confirmed!")) {
                console.error("access ", host, mailconfirm, " error");
                return false;
            }
            console.log("Email Subscription Confirmed!");
            return true;
        });
      });
      return; // not need to get next page

      var nextPageToken = resp.nextPageToken;
      if (nextPageToken) {
        console.log("next =>", nextPageToken);
        hdr.pageToken = nextPageToken;
        getPageOfThreads(request, hdr, result);
      } else {
        callback(result);
      }
    });
  };
  getPageOfThreads(request, hdr, []);
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  var gmail = google.gmail('v1');
  gmail.users.threads.list({
    auth: auth,
    userId: 'me',
    //q: "Activate your Email Subscription to: "
  }, function(err, response) {
    console.log(response);
  });
  return ;
  gmail.users.labels.list({
    auth: auth,
    userId: 'me',
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var labels = response.labels;
    if (labels.length == 0) {
      console.log('No labels found.');
    } else {
      console.log('Labels:');
      for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        console.log('- %s', label.name);
      }
    }
  });
}

