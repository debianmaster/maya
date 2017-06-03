'use strict';
const fs = require('fs')
const https = require('https')
const io = require('socket.io')(8081);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const K8S_HOST = process.env['K8S_HOST'] || '127.0.0.1'
const K8S_PORT = process.env['K8S_PORT'] || '8443'
const K8S_SECRET = process.env['K8S_SECRET'] ||
  fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf-8')

const services=["welcome","time","ks","mysql","myapp","blue","bluegreen","green","scm-web-hooks"]
const routes=["welcome","time","ks","dbtest","myapp","bluegreen","scm-web-hooks"]
const projects=["mycliproject","myjbossapp","consoleproject","binarydeploy","bluegreen","scm-web-hooks"];

var global_namespaces=[];
var socket=null;
var scores={};
io.on('connection', function(soc){
  io.emit('message',scores);
});



makeReq('/api/v1/services?watch=true',function(rawEvent){
  try{
  const event = JSON.parse(rawEvent);
  console.log(event);
  }
  catch(ex){
    console.log(ex);
  }
});


makeReq('/api/v1/namespaces?watch=true',function(rawEvent){
  try{
  const event = JSON.parse(rawEvent);
  if(event.type=='ADDED'){
    global_namespaces[event.object.metadata.name]=event.object.metadata.annotations['openshift.io/requester'];
  }
  console.log(global_namespaces);
  }
  catch(ex){

  }
});

makeReq('/oapi/v1/routes?watch=true',function(rawEvent){
  const event = JSON.parse(rawEvent);
  var obj={svc:event.object.metadata.name,route:event.object.spec.host,usr:getOwner(event.object.metadata.namespace),type:event.type};
  var tmp = obj.usr;
  if(undefined==scores[tmp]){
    if(typeof(tmp)=='string' && isNaN(tmp)) 
    scores[tmp]={};
  }
  if(obj.type=='ADDED' && undefined!=scores[tmp]){
    scores[tmp][obj.svc]=1; 
    console.log(scores);
    io.emit('message',scores);
  }
});

function getOwner (project) {
  if(undefined!=global_namespaces[project])
    return global_namespaces[project];
  else
    return project;
}

function makeReq(url,cb){

  var req = https.request({
      host: K8S_HOST,
      strictSSL: false,
      port: K8S_PORT,
      method: 'GET',
      path: url,
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
              cb(rawEvent);
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
}
