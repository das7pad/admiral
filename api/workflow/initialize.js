'use strict';

var self = initialize;
module.exports = self;

var async = require('async');
var _ = require('underscore');

var APIAdapter = require('../../common/APIAdapter.js');
var envHandler = require('../../common/envHandler.js');

function initialize(req, res) {
  var bag = {
    reqQuery: req.query,
    reqBody: req.body,
    resBody: {},
    apiAdapter: new APIAdapter(req.headers.authorization.split(' ')[1]),
    msgInitialized: false,
    accessKeyEnv: 'ACCESS_KEY',
    secretKeyEnv: 'SECRET_KEY'
  };

  bag.who = util.format('workflow|%s', self.name);
  logger.info(bag.who, 'Starting');

  async.series([
      _checkInputParams.bind(null, bag),
      _saveAccessKey.bind(null, bag),
      _saveSecretKey.bind(null, bag),
      _initializeDatabase.bind(null, bag),
      _getSecrets.bind(null, bag),
      _initializeSecrets.bind(null, bag),
      _getMsg.bind(null, bag),
      _initializeMsg.bind(null, bag),
      _getState.bind(null, bag),
      _initializeState.bind(null, bag),
      _getRedis.bind(null, bag),
      _initializeRedis.bind(null, bag)
    ],
    function (err) {
      logger.info(bag.who, 'Completed');
      if (err)
        return respondWithError(res, err);

      sendJSONResponse(res, bag.resBody);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (!_.has(bag.reqBody, 'msgPassword') ||
    _.isEmpty(bag.reqBody.msgPassword))
    return next(
      new ActErr(who, ActErr.DataNotFound, 'Missing body data: msgPassword')
    );

  if (!_.has(bag.reqBody, 'statePassword') ||
    _.isEmpty(bag.reqBody.statePassword))
    return next(
      new ActErr(who, ActErr.DataNotFound, 'Missing body data: statePassword')
    );


  return next();
}

function _saveAccessKey(bag, next) {
  if (!bag.reqBody.accessKey) return next();
  var who = bag.who + '|' + _saveAccessKey.name;
  logger.verbose(who, 'Inside');

  envHandler.put(bag.accessKeyEnv, bag.reqBody.accessKey,
    function (err) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Cannot set env: ' + bag.accessKeyEnv)
        );

      logger.debug('Set access key');

      return next();
    }
  );
}

function _saveSecretKey(bag, next) {
  if (!bag.reqBody.secretKey) return next();
  var who = bag.who + '|' + _saveSecretKey.name;
  logger.verbose(who, 'Inside');

  envHandler.put(bag.secretKeyEnv, bag.reqBody.secretKey,
    function (err) {
      if (err)
        return next(
          new ActErr(who, ActErr.OperationFailed,
            'Cannot set env: ' + bag.secretKeyEnv)
        );

      logger.debug('Set secret key');

      return next();
    }
  );
}

function _initializeDatabase(bag, next) {
  var who = bag.who + '|' + _initializeDatabase.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.postDB({},
    function (err) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to initialize database.', err)
        );

      return next();
    }
  );
}

function _getSecrets(bag, next) {
  var who = bag.who + '|' + _getSecrets.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.getSecrets(
    function (err, secrets) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to fetch secrets information', err)
        );
      bag.secretsInitialized =
        secrets && secrets.isInstalled && secrets.isInitialized;
      return next();
    }
  );
}

function _initializeSecrets(bag, next) {
  if (bag.secretsInitialized) return next();

  var who = bag.who + '|' + _initializeSecrets.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.postSecrets({},
    function (err) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to initialize secrets provider', err)
        );

      return next();
    }
  );
}

function _getMsg(bag, next) {
  var who = bag.who + '|' + _getMsg.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.getMsg(
    function (err, msg) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to get message information', err)
        );

      bag.msgInitialized = msg && msg.isInstalled && msg.isInitialized;

      return next();
    }
  );
}

function _initializeMsg(bag, next) {
  if (bag.msgInitialized) return next();

  var who = bag.who + '|' + _initializeMsg.name;
  logger.verbose(who, 'Inside');

  var postObj = {
    password: bag.reqBody.msgPassword
  };

  bag.apiAdapter.postMsg(postObj,
    function (err) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to initialize messaging provider', err)
        );

      return next();
    }
  );
}

function _getState(bag, next) {
  var who = bag.who + '|' + _getState.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.getState(
    function (err, state) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to get state information', err)
        );

      bag.stateInitialized = state && state.isInstalled && state.isInitialized;

      return next();
    }
  );
}

function _initializeState(bag, next) {
  if (bag.stateInitialized) return next();

  var who = bag.who + '|' + _initializeState.name;
  logger.verbose(who, 'Inside');

  var postObj = {
    password: bag.reqBody.statePassword
  };

  bag.apiAdapter.postState(postObj,
    function (err) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed,
            'Failed to initialize state provider', err)
        );

      return next();
    }
  );
}

function _getRedis(bag, next) {
  var who = bag.who + '|' + _getRedis.name;
  logger.verbose(who, 'Inside');

  bag.apiAdapter.getRedis(
    function (err, redis) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed, err)
        );

      bag.redisInitialized = redis && redis.isInstalled && redis.isInitialized;

      return next();
    }
  );
}

function _initializeRedis(bag, next) {
  if (bag.redisInitialized) return next();

  var who = bag.who + '|' + _initializeRedis.name;
  logger.verbose(who, 'Inside');

  var postObj = {};

  bag.apiAdapter.postRedis(postObj,
    function (err) {
      if (err)
        return next(
          new ActErr(who, err.id || ActErr.OperationFailed, err)
        );

      return next();
    }
  );
}