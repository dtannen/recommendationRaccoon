
var config = require('./config.js'),
    algo = require('./algorithms.js');
    async = require('async');
    
var updateSequence = function(userId, itemId, update, callback){
  //make the update parameter optional while still allowing the callback to be last (for readability)
  if (typeof update == 'function') {
    callback = update;
    update = true;
  }
  if (update) {
    async.parallel([
      function(cb){
        algo.updateItem(itemId, function(){
          cb(null);
        });
      },
      function(cb){
        algo.updateUser(userId, function(){
          cb(null);
        });
      }
    ],
    function(err){
      if (err){console.log('error', err);}
      callback();
    });
  } else {
    callback();
  }
};

var input = {
  liked: function(userId, itemId, update, callback){
    input.unDisliked(userId, itemId, false, function(){
      client.sismember([config.className, 'item', itemId, 'liked'].join(":"), userId, function(err, results){
        if (results === 0){
          client.zincrby([config.className, 'mostLiked'].join(":"), 1, itemId);
        }
        client.sadd([config.className, 'user', userId,'liked'].join(':'), itemId, function(err){
          client.sadd([config.className, 'item', itemId, 'liked'].join(':'), userId, function(err){
            updateSequence(userId, itemId, update, callback);
          });
        });
      });
    });
  },
  disliked: function(userId, itemId, update, callback){
    input.unLiked(userId, itemId, false, function(){
      client.sismember([config.className, 'item', itemId, 'disliked'].join(":"), userId, function(err, results){
        if (results === 0){
          client.zincrby([config.className, 'mostDisliked'].join(":"), 1, itemId);
        }
        client.sadd([config.className, 'user', userId, 'disliked'].join(':'), itemId, function(err){
          client.sadd([config.className, 'item', itemId, 'disliked'].join(':'), userId, function(err){
            updateSequence(userId, itemId, update, callback);
          });
        });
      });
    });
  },
  unLiked: function(userId, itemId, update, callback){
    client.sismember([config.className, 'item', itemId, 'liked'].join(":"), userId, function(err, results){
      if (results !== 0){
        client.zincrby([config.className, 'mostLiked'].join(":"), -1, itemId);
      }
      client.srem([config.className, 'user', userId,'liked'].join(':'), itemId, function(err){
        client.srem([config.className, 'item', itemId, 'liked'].join(':'), userId, function(err){
          updateSequence(userId, itemId, update, callback);
        });
      });
    });
  },
  unDisliked: function(userId, itemId, update, callback){
    client.sismember([config.className, 'item', itemId, 'disliked'].join(":"), userId, function(err, results){
      if (results !== 0){
        client.zincrby([config.className, 'mostDisliked'].join(":"), -1, itemId);
      }
      client.srem([config.className, 'user', userId, 'disliked'].join(':'), itemId, function(err){
        client.srem([config.className, 'item', itemId, 'disliked'].join(':'), userId, function(err){
          updateSequence(userId, itemId, update, callback);
        });
      });
    });
  },
  unRated: function(userId, itemId, update, callback){
    input.unLiked(userId, itemId, false, function(){
      input.unDisliked(userId, itemId, false, function(){
        updateSequence(userId, itemId, update, callback);
      });
    });
  },
  clearUser: function(userId, update, callback){
    var userLikedSet = [config.className, 'user', userId, 'liked'].join(':');
    var userDislikedSet = [config.className, 'user', userId, 'disliked'].join(':');
    
    client.smembers(userLikedSet, function(err, userLikes) {
      async.each(userLikes,
        function(itemId, cb){
          input.unLiked(userId, itemId, false, function() {
            if (update) {
              algo.updateItem(itemId, function(){
                cb();
              });
            } else {
              cb();
            }
          });
        },
        function(err){
          client.smembers(userDislikedSet, function(err, userDislikes) {
            async.each(userDislikes,
              function(itemId, cb){
                input.unDisliked(userId, itemId, false, function() {
                  if (update) {
                    algo.updateItem(itemId, function(){
                      cb();
                    });
                  } else {
                    cb();
                  }
                });
              },
              function(err){
                if (update) {
                  algo.updateUser(userId, function(){
                    callback();
                  });
                } else {
                  callback();
                }
              }
            );
          });
        }
      );
    });
  },
  clearItem: function(itemId, update, callback){
    var itemLikedSet = [config.className, 'item', itemId, 'liked'].join(':');
    var itemDislikedSet = [config.className, 'item', itemId, 'disliked'].join(':');
    
    client.smembers(itemLikedSet, function(err, itemLikes) {
      async.each(itemLikes,
        function(userId, cb){
          input.unLiked(userId, itemId, false, function() {
            if (update) {
              algo.updateUser(userId, function(){
                cb();
              });
            } else {
              cb();
            }
          });
        },
        function(err){
          client.smembers(itemDislikedSet, function(err, itemDislikes) {
            async.each(itemDislikes,
              function(userId, cb){
                input.unDisliked(userId, itemId, false, function() {
                  if (update) {
                    algo.updateUser(userId, function(){
                      cb();
                    });
                  } else {
                    cb();
                  }
                });
              },
              function(err){
                if (update) {
                  algo.updateItem(itemId, function(){
                    callback();
                  });
                } else {
                  callback();
                }
              }
            );
          });
        }
      );
    });
  }
};

module.exports = input;

