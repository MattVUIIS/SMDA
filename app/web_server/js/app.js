(function() {
  let app = angular.module('application', ['ui.bootstrap', 'ui.router',
    'ui.router.router', 'ngAnimate', 'app.home', 'app.nav',
    'app.atlas']);
  app.factory('AppSettings', ['$window', function($window) {
    let AppSettings = function() {
      this.datePickerPopupFormat = 'dd MMMM yyyy';
      this.queryParamDateFormat = 'YYYYMMDD';
      this.taskServerDateFormat = 'MM-DD-YYYY hh:mm:ss A';
    };
    return new AppSettings();
  }]);
  app.factory('SMDAAccount', ['$window', function($window) {
    let SMDAAccount = function() {};
    SMDAAccount.prototype.setValue = function(key, value) {
      try {
        $window.localStorage.setItem('acct_' + key, JSON.stringify(value));
      }
      catch(e) {
        console.log('Failed to save key "' + key + '" -> ' + value);
      }
    };
    SMDAAccount.prototype.getValue = function(key) {
      let val = undefined;
      try {
        val = JSON.parse($window.localStorage.getItem('acct_' + key));
      }
      catch(e) {
      }
      return val;
    };
    SMDAAccount.prototype.hasValue = function(key) {
      return !(!$window.localStorage.getItem('acct_' + key));
    };
    return new SMDAAccount();
  }]);
  app.config(['$locationProvider', '$stateProvider', '$urlRouterProvider', function($locationProvider, $stateProvider, $urlRouterProvider) {
    $locationProvider.html5Mode(true);
    $urlRouterProvider.otherwise('/404');
    $stateProvider.state('main', {
      abstract: true,
      templateUrl: 'main_frame.html',
    });
    $stateProvider.state('single', {
      abstract: true,
      templateUrl: 'single_frame.html',
    });
    $stateProvider.state('single.tos', {
      url: '/tos',
      secure: true,
      templateUrl: '/smda/html/tos.html',
    });
    $stateProvider.state('single.404', {
      url: '/404',
      templateUrl: '404.html',
    });
  }]);
})();
