(function() {
  var app = angular.module('app.nav', []);
  app.controller('NavigationController', ['$scope', '$state', function($scope, $state) {
    var ctrl = this;
    ctrl.isInHomeState = function() {
      return $state.includes('main.home');
    };
    ctrl.isInAtlasState = function() {
      return $state.includes('main.atlas');
    };
    return ctrl;
  }]);
})();
