'use strict';

/**
 * Test: Plugins
 */

let JAWS        = require('../../lib/Jaws.js'),
    JawsPlugin  = require('../../lib/JawsPlugin'),
    JawsError   = require('../../lib/jaws-error'),
    path        = require('path'),
    os          = require('os'),
    commop      = require ('commop'),
    utils       = require('../../lib/utils'),
    assert      = require('chai').assert,
    shortid     = require('shortid'),
    config      = require('../config');

/**
 * JAWS
 */

let Jaws = new JAWS({
  awsAdminKeyId: '123',
  awsAdminSecretKey: '123',
  interactive: false,
});

/**
 * Define Plugin
 */

class PromisePlugin extends JawsPlugin {

  constructor(Jaws, config) {
    super(Jaws, config);
  }

  /**
   * Register Actions
   */

  registerActions() {
    var config = {
      handler: 'projectCreate',
      command: 'project create',
      options: ['options'],
    };
    this.Jaws.action('ProjectCreate', this._actionProjectCreate.bind(this), config); // bind is optional
  }

  /**
   * Register Hooks
   */

  registerHooks() {
    this.Jaws.hook('PreProjectCreate', this._hookPreProjectCreate.bind(this));
    this.Jaws.hook('PostProjectCreate', this._hookPostProjectCreate.bind(this));
  }

  /**
   * Plugin Logic
   * @param options
   * @returns {*|Promise.<T>}
   * @private
   */

  _actionProjectCreate(options) {
    let _this = this;
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        _this.Jaws.generatorPluginHookAction = true;
        return resolve();
      }, 500);
    })
  }

  _hookPreProjectCreate() {
    let _this = this;
    return new Promise(function(resolve, reject) {
      _this.Jaws.generatorPluginHookPre = true;
      return resolve();
    })
  }

  _hookPostProjectCreate() {
    let _this = this;
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        _this.Jaws.generatorPluginHookPost = true;
        return resolve();
      }, 500);
    })
  }
}

/**
 * Run Tests
 */

describe('Test Promise Plugins', function() {

  before(function(done) {
    Jaws.addPlugin(new PromisePlugin(Jaws, {}));
    done();
  });

  after(function(done) {
    done();
  });

  describe('Test Promise Plugins', function() {
    it('should run and attach values to context', function(done) {

      Jaws.projectCreate({
            name: 'test',
            stage: 'test',
            region: 'us-east-1',
            domain: 'test.com',
            notificationEmail: 'test@test.com',
          })
          .then(function() {
            assert.isTrue(Jaws.generatorPluginHookPre);
            assert.isTrue(Jaws.generatorPluginHookPost);
            assert.isTrue(Jaws.generatorPluginHookAction);
            done();
          })
          .catch(function(e) {
            done(e);
          });
    });
  });
});