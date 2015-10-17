# autogfeeder
auto login with google feedburner and generate subscribe url

# how to use
```
> git clone  https://github.com/arvin-chou/autogfeeder.git
> npm install crawler underscore
> user="ur google account" pass="ur google password" feed="ur url want to burn" node ./index.js
```
# Example
```
> feed="http://rss.ptt.cc/Japan_Travel.xml" node ./index.js
feed:  http://rss.ptt.cc/Japan_Travel.xml
redirest to feedburner.google.com
redirest to add.feedburner.google.com
Welcome! Let us burn a feed for you.
Feed Title: 批踢踢實業坊 Japan_Travel 板
Congrats! Your FeedBurner feed is now live. Want to dress it up a little?
try to access fbat
Subscription Management
https://feedburner.google.com/fb/a/mailverify?uri=ptt/KYke
```
