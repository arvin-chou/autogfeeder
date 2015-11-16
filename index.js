/**
 * tested in 2015/10/17
 */

var Crawler = require("crawler");
var url = require("url");
var vm = require('vm');
var request = require("request");
var cheerio = require("cheerio");
var _ = require("underscore");
var extend = require("util")._extend;
var fs = require('fs');
var readline = require('readline');
var gInbox = require("./gInbox.js");
var j = request.jar();
request = request.defaults({jar:j});

var user = process.env.user || "";
var pass = process.env.pass || "";
var feed = process.env.feed || process.env.FEED || "";
var etosub = process.env.etosub || "";
var blacklist = process.env.blacklist || "blacklist.log"
var blacklist_json = [];
try {
  blacklist_json = JSON.parse(fs.readFileSync(blacklist).toString());
  console.log("read from blacklist from ", blacklist);
}
catch(e) {
  console.log("read from blacklist from ", blacklist, " fail, ", e);
}
var captchaFilePath = "./captchaImg.png";

var host = "https://feedburner.google.com";
var headers = {
  "Content-Type" : "application/x-www-form-urlencoded",
  "User-Agent" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11) AppleWebKit/601.1.56 (KHTML, like Gecko) Version/9.0 Safari/601.1.56",
  "Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "DNT": 1
};

var formDataEncode = function(formData) {
  return _.map(formData, function(e, i){ 
    return i + "=" +encodeURIComponent(formData[i]);
  }).join('&');
};

var preparedToBurd = function (err, feeders, opts) {
  var httpResponse = opts.httpResponse, 
  body = opts.body, 
  hs = opts.hs, 
  gsessionid = opts.gsessionid;

  delete hs['content-length'];
  console.log("Welcome! Let us burn a feed for you.");
  if (err) {
    return console.error('failed:', err);
  }
  //console.log(body);
  var $ = cheerio.load(body);
  var params = [ "name", "from", "fbat", "mappedUri", "sourceUrl", "org.apache.struts.taglib.html.TOKEN"];
  var formData = {};
  var feedName;

  _.each(params, function(e, i){
    formData[e] = $("[name='"+e+"']").first().val();
  });

  formData.podcast = "false";
  formData.authenticationAction = "register";

  feedName = formData.name;

  console.log("Feed Title:", formData.name);
  if (!formData.name) {
    console.log("no feed");
    return false;
  }

  var idx = feeders.indexOf(formData.name);
  if (-1 !== idx) {
    console.log("duplicate feed: ", formData.name, "in feeders(",
        idx,
        "), 81");
    return false;
  }

  idx = blacklist_json.indexOf(formData.name);
  if (-1 !== idx) {
    console.log("duplicate feed: ", formData.name, " in blacklist(", 
        idx, "), 81");
    return false;
  }

  request.post({
    url: host + "/fb/a/addfeed?gsessionid=" + gsessionid,
    headers: hs,
    //formData: formData,
    json: true,
    body: formDataEncode(formData),
    jar: j
  }, function optionalCallback(err, httpResponse, body) {
    console.log("Congrats! Your FeedBurner feed is now live. Want to dress it up a little?");
    if (err) {
      return console.error('failed:', err);
    }

    //console.log(body);
    var $ = cheerio.load(body);
    var id = $("[name=id]").first().val();

    formData.id = id;
    formData.emailSyndicationPartner = "feedburner";
    formData.emailSyndicationEnabled = "true";
    formData.isSave = "false";

    var b = formDataEncode(formData),
    c = b.length;
    hs['content-length'] = c;

    request.post({
      url: host + "/fb/a/emailsyndicationSubmit",
      //timeout: 1500,
      headers: hs,
      //formData: formData,
      json: true,
      body: b,
      jar: j
    }, function optionalCallback(err, httpResponse, body) {
      console.log("try to access fbat");
      if (err) {
        return console.error('failed:', err);
      }
      //console.log(body);
      var $ = cheerio.load(body);
      var params = [ "fbat" ];
      var formData = {};

      _.each(params, function(e, i){
        formData[e] = $("[name='"+e+"']").first().val();
      });

      formData.id = id;
      formData.emailSyndicationPartner = "feedburner";
      formData.emailSyndicationEnabled = "true";
      formData.isSave = "false";
      delete hs['content-length'];

      request.post({
        url: host + "/fb/a/emailsyndicationSubmit",
        //timeout: 1500,
        headers: hs,
        //formData: formData,
        json: true,
        //body: b,
        body: formDataEncode(formData),
        jar: j
      }, function optionalCallback(err, httpResponse, body) {
        console.log("Subscription Management");
        if (err) {
          return console.error('failed:', err);
        }
        //console.log(body);
        var $ = cheerio.load(body),
        subUrl,
        formData = {};

        $ = cheerio.load($('textarea').val());
        subUrl = $("form").first().attr("onsubmit").split(',')[0].split("'")[1];
        console.log(subUrl);

        formData.email = etosub;

        request.post({
          body: formDataEncode(formData),
          url: subUrl,
        }, function (error, httpResponse, body) {
          if (!error && httpResponse.statusCode == 200) {
            //console.log(httpResponse);
            //console.log(body);

            var formData = {};
            var hs = extend({}, headers);
            var $ = cheerio.load(body);
            var imgUrl = $("form img").first().attr("src");
            formData.email = etosub;
            formData.uri = $("input[name=uri]").first().val();
            formData.token = $("input[name=token]").first().val();
            console.log("Email Subscription Request - ", $("form > p").first().text());
            hs.Referer = host + "/fb/a/myfeeds";

            var reSendCaptcha = function(imgUrl, token) {
              var r = request.get(host + "/fb/a/" + imgUrl);
              r.on('response', function(response) {
                var writeStream = response.pipe(fs.createWriteStream(captchaFilePath));
                writeStream.on('close', function() {
                    var rl = readline.createInterface({
                      input: process.stdin,
                      output: process.stdout
                    });

                    rl.question('we save png in '+captchaFilePath+', Enter the code from that captchaFile here: ', function(code) {
                      rl.close();
                      console.log("ur enter, ", code);

                      formData.captcha = code;
                      formData.token = token;

                      var hs = extend({}, headers);
                      hs.Referer = subUrl;
                      //console.log(formData, "formData");

                      request.post({
                        headers: hs,
                        json: true,
                        body: _.map(formData, function(e, i){ return i + "=" +formData[i];}).join('&'),
                        //body: _.map(formData, function(e, i){ return i + "=" +formData[i];}).join('&'),
                        url: subUrl,
                      }, function (error, httpResponse, body) {
                        if (!error && httpResponse.statusCode == 200) {
                          //console.log(httpResponse);
                          //console.log(body);
                          //console.log("formDataEncode(formData)", formDataEncode(formData));
                          if (-1 === body.indexOf("Your request has been accepted!")) {
                            console.error("something wrong, plz refill again");
                            var $ = cheerio.load(body);
                            var imgUrl = $("form img").first().attr("src");
                            var token = $("input[name=token]").first().val();

                            reSendCaptcha(imgUrl, token);
                          }
                          else {
                            console.log("Your request has been accepted!, delay 5s");
                            setTimeout(gInbox.accessInbox, 5000, feedName);
                            return;
                            //gInbox.accessInbox(feedName);
                          }
                        }
                      });
                    });
                });

                writeStream.on('error', function(err) {
                  console.error(err);
                  //this.end();
                });
              });
            }
            reSendCaptcha(imgUrl, formData.token);
          }
        });
      });
    });
  });
};


console.log("feed: ", feed);
request(host, function(error, result, body) {
  var $ = cheerio.load(body);
  var _botguard;
  var w = {}, d = {};

  $('script').filter(function(i, elem) {
    //console.log($(this).text(), i);
    return $(this).text().indexOf("botguard") !== -1;
  }).each(function(i, elem) {
    (function(window, document, that) {
      _botguard = eval($(that).text());
      //console.log(_botguard, "_botguard");
      //console.log($(that).text(), i);
    })(w, d, this);
  });

  var formData = {};
  formData.Page  = "PasswordSeparationSignIn";
  formData["continue"] = host + "/fb/a/myfeeds";
  formData.service = "feedburner";
  formData.checkedDomains = "youtube";
  formData.checkConnection = "youtube:711:0";
  formData.checkConnection = "youtube:"+_.random(700, 5000)+":0";
  formData.pstMsg = 1;
  formData.sacu = 1;
  formData.Email = user;
  formData.Passwd = pass;
  formData.PersistentCookie = "yes";
  formData.rmShown = 1;
  formData.signIn = "Sign in";
  formData._utf8 = '☃';

  var r;
  d.bg.invoke(function(_r){r = _r;});
  formData.bgresponse = r;
  formData.GALX = $("[name=GALX]").val();

  var hs = extend({}, headers);
  hs.Origin = "https://accounts.google.com";

  // [ 'gsessionid=59h93MHk4wJOzC4S28y2kg' ] => 59h93MHk4wJOzC4S28y2kg
  var gsessionid = _.filter(result.socket._httpMessage.path.split('&'),
      function(e, i){ 
        return e.indexOf("gsessionid") !== -1; 
      })[0].split('=')[1];

  request.post({
    //url: hs.Origin + "/accountLoginInfoXhr", 
    url: "https://accounts.google.com/accountLoginInfoXhr",
    headers: {
      referer: "https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Ffeedburner.google.com%2Ffb%2Fa%2Fmyfeeds&service=feedburner&sacu=1",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    json: true,
    body: _.map(formData, function(e, i){ return i + "=" +formData[i];}).join('&'),
    jar: false
  }, function optionalCallback(err, httpResponse, body) {
    if (_.isObject(body))
    {
      //console.log("httpResponse = ", body);
      if (!body.encoded_profile_information)
      {
        console.log("google need SHOW_CAPTCHA, plz cold down 1-2min and retry");
        return;
      }
      formData.ProfileInformation = body.encoded_profile_information;
    }
    else
    {
      console.log("httpResponse = nothing");
      return;
    }

    request.post({
        url: hs.Origin + "/ServiceLoginAuth", 
        headers: hs,
        json: true,
        body: _.map(formData, function(e, i){ return i + "=" +formData[i];}).join('&'),
        jar: j
      }, function optionalCallback(err, httpResponse, body) {
        //console.log("httpResponse = ", httpResponse);

        if (err) {
          return console.error('failed:', err);
        }

        var $ = cheerio.load(body);
        //console.log(body);

        var e = $("span.error-msg").text();
        if($("span.error-msg").text()) {
          console.log(e);
          return false;
        }

        request.get({
          url: $('a').first().attr("href"),
          jar: j
        }, function (error, httpResponse, body) {
          if (!error && httpResponse.statusCode == 200) {
            console.log("redirest to feedburner.google.com");
            //console.log(httpResponse);
            //console.log(body);

            var formData = {};
            var hs = extend({}, headers);
            var $ = cheerio.load(body);
            var feeders = $("td.title").map(function(index, element){
              return ($(this).text().trim());
            }).get();
            var opts = {};

            opts.hs = hs;
            opts.gsessionid = gsessionid;

            formData.fbat = $("[name='fbat']").first().val();
            formData.from = $("[name='from']").first().val();
            formData.sourceUrl = feed;

            hs.Referer = host + "/fb/a/myfeeds";
            hs.Origin = host;

            request.post({
              url: host + "/fb/a/addfeed?gsessionid=" + gsessionid,
              headers: hs,
              //formData: formData,
              json: true,
              body: _.map(formData, function(e, i){ return i + "=" +formData[i];}).join('&'),
              jar: j
            }, function optionalCallback(err, httpResponse, body) {
              console.log("redirest to add.feedburner.google.com");
              //console.log(httpResponse);
              if (err) {
                return console.error("failed:", err);
              }

              var $ = cheerio.load(body);
              var formData = {};
              var name = $("[name='name']").first().val();
              if (name) {
                // directly goto
                opts.httpResponse = httpResponse;
                opts.body = body;
                preparedToBurd(err, feeders, opts);
                return;
              }

              formData.from = $("[name='from']").first().val();
              formData.fbat = $("[name='fbat']").first().val();
              formData.podcast = "false";
              formData.sourceUrl = $("[name='sourceUrl']:checked").val();

              var b =  formDataEncode(formData),
              c = b.length;

              hs.Referer = host + "/fb/a/addfeed";
              hs['content-length'] = c;

              request.post({
                url: host + "/fb/a/addfeed?gsessionid=" + gsessionid,
                headers: hs,
                //formData: formData,
                json: true,
                body: b,
                jar: j
              }, function optionalCallback(err, httpResponse, body) {
                opts.httpResponse = httpResponse;
                opts.body = body;
                preparedToBurd(err, feeders, opts);
              });
            });
          }
          else
            return console.error('failed:', err);
        });
      });
  });
});
