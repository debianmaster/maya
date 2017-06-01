'use strict';
const fs = require('fs')
const https = require('https')
const io = require('socket.io')(8080);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const K8S_HOST = process.env['K8S_HOST'] || '127.0.0.1'
const K8S_PORT = process.env['K8S_PORT'] || '8443'
const K8S_SECRET = process.env['K8S_SECRET'] ||
  fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf-8')

console.log(K8S_SECRET);
var socket=null;
var scores={};
io.on('connection', function(soc){
  io.emit('message',scores);
});
var req = https.request({
    host: K8S_HOST,
    strictSSL: false,
    port: K8S_PORT,
    method: 'GET',
    path: '/oapi/v1/routes?watch=true',
    headers: {
      Authorization: 'Bearer ' + K8S_SECRET
    }
  }, (res) => {
    console.log('Watching namespace events...')
    
    res.setEncoding('utf8')
    //var scores=[];
    res.on('data', (chunk) => {
      const rawEvents = chunk.split('\n')
      rawEvents.forEach(function (rawEvent) {
        if (rawEvent.length > 0) {
          try{
            const event = JSON.parse(rawEvent);
            console.log(event);
            //console.log('    %s was %s %s owner is %s', event.object.metadata.name, event.type.charAt(0) + event.type.substring(1).toLowerCase(),event.object.spec.host,getOwner(event.object.spec.host))
            var obj={svc:event.object.metadata.name,route:event.object.spec.host,usr:getOwner(event.object.metadata.namespace),type:event.type};
            var tmp = obj.usr;
            if(undefined==scores[tmp]){
              if(typeof(tmp)=='string' && isNaN(tmp)) 
              scores[tmp]={};
            }
            if(obj.type=='ADDED' && undefined!=scores[tmp]){
              scores[tmp][obj.svc]=1; 
              console.log(scores);
              //io.emit('message','test');
              io.emit('message',scores);
              //console.log('after',scores);
            }
          }
          catch(ex){
            console.log(ex);
          }
        }
      })
    })

    res.on('end', () => {
      console.log('  Event stream closed...')
    })
  })

  req.on('error', (err) => {
    console.log(err);
    console.log('Problem with request: %s', err.message)
  });

  req.end()


function getOwner(r){
  try{
   //r is full route.  extract 'debianmaster' from welcome.debianmaster.10.91.109.46.xip.io
   var owner=r.substr(r.indexOf('-')+1);
   return owner;
  }
  catch(ex){
    return "";
  }
}

function getOwner2(r){
  try{
   //r is full route.  extract 'debianmaster' from welcome.debianmaster.10.91.109.46.xip.io
   var owner=r.substring(r.indexOf('.')+1,r.indexOf('.',r.indexOf('.')+1));
   return owner;
  }
  catch(ex){
    return "";
  }
}


