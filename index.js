  'use strict';
  const fs = require('fs')
  const https = require('https')
  const io = require('socket.io')(8080);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const K8S_HOST = process.env['K8S_HOST'] || '127.0.0.1'
  const K8S_PORT = process.env['K8S_PORT'] || '8443'
  const K8S_SECRET = process.env['K8S_SECRET'] ||
    fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf-8')
 
  const asserts={ service: ["welcome","time","ks","mysql","myapp","blue","bluegreen","green","scm-web-hooks"],
                  route: ["welcome","time","ks","dbtest","myapp","bluegreen","scm-web-hooks"],
                  namespace: ["mycliproject","myjbossapp","consoleproject","binarydeploy","bluegreen","scm-web-hooks"]
  }

  var global_namespaces=[];
  var socket=null;
  var scores={};
  io.on('connection', function(soc){
    io.emit('message',scores);
  });



  makeReq('/api/v1/services?watch=true',function(rawEvent){
    try{
      const event = JSON.parse(rawEvent);
      handleADD('service',getOwner(event.object.metadata.namespace),event.object.metadata.name);
    }
    catch(ex){
      //console.log(ex);
    }
  });


  makeReq('/api/v1/namespaces?watch=true',function(rawEvent){
    try{
      const event = JSON.parse(rawEvent);
      if(event.type=='ADDED'){
        global_namespaces[event.object.metadata.name]=event.object.metadata.annotations['openshift.io/requester'];
        console.log(global_namespaces);
        handleADD('namespace',getOwner(event.object.metadata.name),event.object.metadata.name);
      }
    }
    catch(ex){
      //console.log(ex);
    }
  });

  makeReq('/oapi/v1/routes?watch=true',function(rawEvent){
    try{
      const event = JSON.parse(rawEvent);
      if(event.type=='ADDED'){
        handleADD('route',getOwner(event.object.metadata.namespace),event.object.metadata.name,event.object.spec.host);
      }
    }
    catch(ex){
      //console.log(ex);
    }
  });

  function getOwner (project) {
    if(undefined!=global_namespaces[project])
      return global_namespaces[project];
    else
      return undefined;
  }

  function handleADD(type,usr,name,extras){
    console.log(type,"  ",usr," ",name," ",extras);
    if(undefined==usr) return;
    //if(asserts[type].indexOf(name)===-1) return;
    if(undefined==scores[usr]){
      scores[usr]={};
    }
    if(undefined!=scores[usr]){
      scores[usr][type+"-"+name]=1; 
      io.emit('message',scores);
    }
    console.log(scores);
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
        console.log('Watching  events...')
        
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
