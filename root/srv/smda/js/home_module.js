(function() {
  var app = angular.module('app.home', []);
  app.controller('HomeController', ['$scope', '$state', function($scope, $state) {
    var ctrl = this;
    return ctrl;
  }]);
  app.config(['$stateProvider', function($stateProvider) {
    $stateProvider.state('main.home', {
      url: '/',
      templateUrl: '/smda/html/home.html',
      controller: 'HomeController',
      controllerAs: 'homeCtrl',
    });
  }]);
})();
