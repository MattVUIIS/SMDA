(function() {
  var app = angular.module('app.atlas', []);
  app.controller('AtlasController', ['$scope', '$state', '$stateParams', '$http', function($scope, $state, $stateParams, $http) {
    let ctrl = this;
    ctrl.checkNavState = function(stateName, subject) {
      //console.log('checkNavState state.name == ' + stateName + ' = ' + $state.is('main.atlas.' + stateName) +
      //  ' stateParams: ' + JSON.stringify($stateParams));
      return $state.is('main.atlas.' + stateName) && $stateParams['subject'] == subject.name;
    };
    return ctrl;
  }]);
})();
