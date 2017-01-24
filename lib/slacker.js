  'use strict';
  
  // TODO: manage this
  var colour = require('colour');
  
  // instance
  var instance = new Scripts(
    new Api(authenticate, message, listen), new Deps(), new Data(new Credentials())
  );
  
  function Message(text, channel, parse, shouldLinkNames, attachments, links, media, username, asUser) {
    this.text = text || null;
    this.channel = channel || null;
    this.parse = parse || null;
    this.link_names = shouldLinkNames || null;
    this.attachments = attachments || [];
    this.unfurl_links = links || false;
    this.unfurl_media = media || false;
    this.username = username || null;
    this.as_user = asUser || false;
  }
  
  function Response(type, channel, user, text, team) {
    this.type = type || null;
    this.channel = channel || null;
    this.user = user || null;
    this.text = text || null;
    this.team = team || null;
  }  
  
  function SlackEntity(id, name) {
    this.id = id || null;
    this.name = name || null;
  }
  
  function Credentials(provided, token) {
    this.provided = provided || false;
    this.token = token || null;
  }
  
  function Api(authenticate, message, listen) { 
    this.authenticate = authenticate || undefined;
    this.message = message || undefined;
    this.listen = listen || undefined;
  }
  
  function Deps(slack, slackNode, utils) {
    this.slack = slack || undefined;
    this.slackNode = slackNode || undefined;
    this.utils = utils || undefined;
  }
  
  function Data(credentials, users, channels, groups) {
    this.credentials = credentials || undefined;
    this.users = users || [];
    this.channels = channels || [];
    this.groups = groups || [];
  }
  
  function Scripts(api, deps, data) {
    this.api = api || undefined;
    this.deps = deps || undefined;
    this.data = data || undefined;
  }
  
  function buildResponseOfMessage(response) {
    var channel = getNameById(response.channel, instance.data.channels);
    var user = getNameById(response.user, instance.data.users);
    
    return new Response(response.type, channel, user, response.text, response.team);
  }
  
  function buildMessage(text, channel) {
    return new Message(text, channel, 'full', 1, null, true, true, 'user', true);
  }  
  
  function buildFromResponse(list) {
    var result = [];
    
    if (instance.deps.utils.object.isArrayNotEmpty(list)) {
      for(var i = 0; i < list.length; i++) {
        result.push(new SlackEntity(list[i].id, list[i].name));      
      }           
    }
    
    return result;
  }   
  
  function buildData() {
    instance.deps.slackNode.api('users.list', function(error, response) {
      if(!response.ok) {
        console.log(' - error fetching users: ' + response.error);
      } else {
        instance.data.users = buildFromResponse(response.members);        
      }      
    });

    instance.deps.slackNode.api('channels.list', function(error, response) {
      if(!response.ok) {
        console.log(' - error fetching channels: ' + response.error);
      } else {
        instance.data.channels = buildFromResponse(response.channels);        
      }      
    });
    
    instance.deps.slackNode.api('groups.list', function(error, response) {
      if(!response.ok) {
        console.log(' - error fetching groups: ' + response.error);
      } else {
        instance.data.groups = buildFromResponse(response.groups);        
      }      
    });    
  }
  
  function getIdByName(name, list) {
    for(var i = 0; i < list.length; i++) {
      if (list[i].name === name) {
        return list[i].id;
      }      
    }
    
    return null;
  }
  
  function getNameById(identifier, list) {
    for(var i = 0; i < list.length; i++) {
      if (list[i].id === identifier) {
        return list[i].name;
      }      
    }
    
    return null;    
  }
  
  function findInAllLists(name) {
    var result = null;
    
    if(!instance.deps.utils.object.isValidString(result)) {
      result = getIdByName(name, instance.data.users);
    }
    
    if(!instance.deps.utils.object.isValidString(result)) {
      result = getIdByName(name, instance.data.channels);
    }

    if(!instance.deps.utils.object.isValidString(result)) {
      result = getIdByName(name, instance.data.groups);
    }
    
    return result;
  }

  function getSlackNodeInstance(token) {
    var Constructor = require('slack-node') || undefined;
    
    return new Constructor(token);
  }
  
  function displayMessage(response) {
    var userString = (instance.deps.utils.object.isValidString(response.user))  
      ? response.user.blue : 'UNKNOWN_USER';
    var channelString = (instance.deps.utils.object.isValidString(response.channel)) 
      ? (' @ ' + response.channel.red) : '';

    console.log(' - ' + userString + channelString + ': ' + response.text);
  }     
  
  /**
   * API
   **/
   
  function authenticate(token) {
    instance.deps.slackNode = getSlackNodeInstance(token);
    instance.data.credentials = (instance.deps.utils.object.isValidString(token)) 
      ? new Credentials(true, token) : new Credentials(false, ''); 
      
    // trigger builds...   
    buildData();
  }
  
  function message(userChannelOrGroup, text, callback) {
    if (!checkPreconditions()) {
      callback(false);
    }
    
    var identifier = findInAllLists(userChannelOrGroup);    
    if(instance.deps.utils.object.isValidString(identifier)) {
      instance.deps.slackNode.api(
        'chat.postMessage', buildMessage(text, identifier), function(error, response) {
          console.log(' - response: ', response);
          console.log(' - error: ', error);
          callback(true);   
        }
      );       
    } else {
      console.error(' - [ERROR] - target: ' + userChannelOrGroup + ' not found'); 
      callback(false);    
    }
  }
  
  function listen() {
    var bot = instance.deps.slack.rtm.client();
    
    bot.message(function(response, error) {
      
      if (instance.deps.utils.object.isInstanceValid(error)) {
        console.log(' - [ERROR] - stack: ', error);
      } else {
        displayMessage(buildResponseOfMessage(response));
      }           
    });
    
    bot.listen({token: instance.data.credentials.token });
  }  
  
  /**
   * initialize
   **/ 
   
  function isInstanceValid(instance) {
    return (instance !== undefined);
  }  
  
  function preconditions(api) {
    for (var property in api) {
      if (api.hasOwnProperty(property)) {
        if (!isInstanceValid(api[property])) {
          console.error(' - [ERROR] - dependency: ' + property + ' not found when initializing library');
          return false;
        }
      }
    }

    return true;
  }
  
  function isDataLoaded() {
    if (!instance.deps.utils.object.isArrayNotEmpty(instance.data.users)) {
      console.error(' - [ERROR] - users are not fully loaded yet');
      return false;      
    }

    if (!instance.deps.utils.object.isArrayNotEmpty(instance.data.channels)) {
      console.error(' - [ERROR] - channels are not fully loaded yet');
      return false;      
    }

    if (!instance.deps.utils.object.isArrayNotEmpty(instance.data.groups)) {
      console.error(' - [ERROR] - groups are not fully loaded yet');
      return false;      
    }
    
    return true;
  }
  
  function checkPreconditions() {
    return (preconditions(instance.deps) && instance.data.credentials.provided && isDataLoaded());
  }  
   
  function fetch() {
    var slack = require('slack') || undefined;
    var slackNode = undefined;
    var utils = require('node-utilities') || undefined;
    
    return new Deps(slack, slackNode, utils);    
  } 
   
  function initialize() {
    instance.deps = fetch();
  }
  
  initialize();
  module.exports = instance.api;