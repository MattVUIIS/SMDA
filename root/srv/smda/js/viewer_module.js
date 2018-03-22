(function() {
    let app = angular.module('app.atlas', ['angularSpinner', 'dndLists']);
    app.controller('ViewerController', ['$scope', '$state', '$http', '$compile', '$timeout', 'usSpinnerService', 'SMDAAccount',
    function($scope, $state, $http, $compile, $timeout, usSpinnerService, SMDAAccount) {
        $scope.tooltip_delay = 1000;
        $scope.dropViewLayer = function(index, view_layer) { // Called when view layer is reordered by user
            $scope.context.moveLayer(view_layer, index);
            return true;
        };
        $scope.setCanvasParent = function(canvasParent) {
            //console.log('setCanvasParent');
            $scope.pan = {};
            $scope.context = new ViewerContext($(canvasParent), {
                getSavedValue: function(name) {
                    SMDAAccount.getValue(name);
                },
                setSavedValue: function(name, value) {
                    SMDAAccount.setValue(name, value);
                },
                hasSavedValue: function(name) {
                    return SMDAAccount.hasValue(name);
                },
                getScopeVariable: function(name) {
                    return $scope[name];
                },
                setScopeVariable: function(name, value) {
                    //console.log('setScopeVariable ' + name + ' to ' + value);
                    $scope[name] = value;
                },
                createSpinnerElement: function(spinner_key, options) {
                    options = options || {color: '#fff'};
                    let s = '<span us-spinner=' + JSON.stringify(options) + ' ' +
                        'spinner-key="' + spinner_key + '" ' +
                        'spinner-start-active="true"></span>';
                    return $compile(s)($scope);
                },
                activateSpinner: function(spinner_key) {
                    usSpinnerService.spin(spinner_key);
                },
                deactivateSpinner: function(spinner_key) {
                    usSpinnerService.stop(spinner_key);
                },
                getSubjects: function() {
                    (function(info_url, state_params) {
                        $http({
                            method: 'GET',
                            url: info_url,
                        })
                        .then(function(response) {
                            $scope.context.subjects.push.apply($scope.context.subjects, response.data);

                        }, function(error) {
                            console.log('Failed to retrieve subjects: ' + JSON.stringify(error));
                        });
                    })('/smda/info/subjects', $state.params);
                },
                getSubjectInfo: function(subject, event_handler) {
                    (function(info_url, event_handler){
                        $http({
                            method: 'GET',
                            url: info_url,
                        })
                        .then(function(response) {
                            $state.go($state.current,
                                event_handler(subject, response.data),
                                {notify: false});
                        }, function(error) {
                            console.log('Failed to retrieve subject data: ' +
                                JSON.stringify(error));
                        });
                    })('/smda/info/' + subject, event_handler);
                },
                updatePageState: function() {
                    $timeout(function() {
                        //console.log('Update page state with ' + JSON.stringify($scope.context.view_params));
                        $state.go($state.current, $scope.context.view_params, {notify: false});
                    });
                },
                requestHTTP: function(config, on_response, on_error) {
                    $http(config).then(on_response, on_error);
                },
            });
            //Get the resource information from the server to initialize the viewer
            let subject = $state.params.subject;
            (function(info_url, state_params){
                $http({
                    method: 'GET',
                    url: info_url,
                })
                .then(function(response) {
                    $state.go($state.current,
                        $scope.context.setResource(response.data, state_params),
                        {notify: false});
                }, function(error) {
                    console.log('Failed to retrieve subject data: ' +
                        JSON.stringify(error));
                });
            })('/smda/info/' + subject, $state.params);
        }
        $scope.$on('$stateChangeStart',
            function(event, toState, toParams, fromState, fromParams, options) {
                //console.log('state change start: ' + JSON.stringify(fromState) +
                //    ' to ' + JSON.stringify(toState));
            });
        $scope.$on('$stateChangeSuccess',
            function(event, toState, toParams, fromState, fromParams, options) {
                //console.log('state change success');
            });
        $scope.$on('$stateChangeError',
            function(event, toState, toParams, fromState, fromParams, options) {
                //console.log('state change error');
            });
        return $scope;
    }]);
    //Configure the panel spinners
    app.config(['usSpinnerConfigProvider', function(usSpinnerConfigProvider) {
        usSpinnerConfigProvider.setDefaults({opacity: 0});
    }]);
    app.directive('viewerContainer', function() {
        return {
            restrict: 'E',
            controller: 'ViewerController',
            controllerAs: 'viewer',
            templateUrl: 'html/viewer.html',
        };
    });
    app.directive('viewerPanelContainer', ['$parse', function($parse) {
        return {
            restrict: 'A',
            scope: false,
            link: function(scope, element) {
                //console.log('link viewerPanelContainer ' + scope.$id);
                if(!('context' in scope)) {
                  scope.setCanvasParent(element);
                }
            }
        };
    }]);
    //Verifies that an input element stays in it's given [min, max] values and
    //prevents the user from entering bad input. Also accepts minLink and
    //maxLink attributes. rangeMaxLink points to a scope variable that should be
    //updated if the input value is larger than the rangeMaxLink. rangeMinLink
    //points to a scope variable that should be updated if the input value is
    //smaller than the rangeMinLink.
    app.directive('rangeValidation', ['$parse', function($parse) {
        return {
            restrict: 'A',
            require: 'ngModel',
            scope: false,
            link: function(scope, element, attrs, ngModel) {
                scope.$watch(attrs.ngModel, function(newValue, oldValue) {
                    if(newValue == oldValue) {
                        return;
                    }
                    if(isNaN(newValue)) {
                        ngModel.$setViewValue(oldValue);
                        ngModel.$render();
                        return;
                    }
                    //console.log('rangeValidation - newValue is ' + typeof newValue);
                    newValue = Math.min(attrs.max, Math.max(attrs.min,
                        parseInt(newValue, 10)));
                    //console.log('rangeValidation - newValue is now ' + typeof newValue);
                    if(attrs.rangeMaxLink) {
                        let rangeMaxLink = scope.$eval(attrs.rangeMaxLink);
                        let model = $parse(attrs.rangeMaxLink);
                        //console.log('rangeValidation - assign maxLink');
                        model.assign(scope, Math.max(newValue, rangeMaxLink));
                    }
                    if(attrs.rangeMinLink) {
                        let rangeMinLink = scope.$eval(attrs.rangeMinLink);
                        let model = $parse(attrs.rangeMinLink);
                        //console.log('rangeValidation - assign minLink');
                        model.assign(scope, Math.min(newValue, rangeMinLink));
                    }
                    if(newValue !== oldValue) {
                        //console.log('rangeValidation - update');
                        let model = $parse(attrs.ngModel);
                        model.assign(scope, newValue);
                        //scope.context.drawScene();
                    }
                });
                ngModel.$parsers.push(function(value) {
                    return '' + value;
                });
                ngModel.$formatters.push(function(value) {
                    return parseInt(value, 10);
                });
                element.on("keypress", function(event) {
                    if(!/^[\-?\d]$/.test(String.fromCharCode(event.which)))
                        event.preventDefault();
                });
            }
        };
    }]);
    app.directive('numberConvert', function() {
        return {
            restrict: 'A',
            require: 'ngModel',
            scope: false,
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(value) {
                    return '' + value;
                });
                ngModel.$formatters.push(function(value) {
                    return parseInt(value, 10);
                });
            }
        };
    });
    app.controller('PanelController', ['$scope', function($scope) {
        $scope.tab = 1;
        $scope.selectTab = function(newTab) {
            $scope.tab = newTab;
        };
        $scope.isSelected = function(tab) {
            return $scope.tab === tab;
        }
        return $scope;
    }]);
    app.config(['$stateProvider', function($stateProvider) {
      $stateProvider.state('main.atlas', {
          url: '/atlas',
          abstract: true,
          templateUrl: '/smda/html/atlas.html',
        });

      $stateProvider.state('main.atlas.viewer', {
          url: '/viewer?{subject}&{view}&{layers}' +
            '&{slice:int}&{ax_slice:int}&{sa_slice:int}' +
            '&{zoom:int}&{ax_zoom:int}&{sa_zoom:int}' +
            '&{px}&{py}&{pz}' +
            '&{x}&{y}&{ax_x}&{ax_y}&{sa_x}&{sa_y}' +
            '&{stain}&{proc}&{session:int}&{param}&{vivo}' +
            '&{Diffusion_tensor_vol}&{RA_vol}&{VR_vol}' +
            '&{label}&{glyph}' +
            '&{block_a:int}&{hist_a:int}&{MR_a:int}&{label_a:int}&{glyph_a:int}',
          params: {
            'subject': 'default',
            'view': 'BL',
            'layers': 'BL,HI',
            'slice': 128,
            'ax_slice': 1,
            'sa_slice': 1,
            'zoom': 1,
            'ax_zoom': 1,
            'sa_zoom': 1,
            'px': '0',
            'py': '0',
            'pz': '0',
            'x': '0',
            'y': '0',
            'ax_x': '0',
            'ax_y': '0',
            'sa_x': '0',
            'sa_y': '0',
            'stain': 'BDA',
            'proc': 'T2',
            'session': 1,
            'param': '',
            'vivo': 'exvivo',
            'Diffusion_tensor_vol': '1',
            'RA_vol': '1',
            'VR_vol': '1',
            'label': 'roi',
            'glyph': 'DTI',
            'block_a': 100,
            'hist_a': 100,
            'MR_a': 100,
            'label_a': 100,
            'glyph_a': 100,
          },
        });
    }]);
    app.run(['$rootScope', '$state', function($rootScope, $state) {
      $rootScope.$on('$stateChangeStart', function(event, toState, toParams,
          fromState, fromParams) {
        //console.log('got rootScope ' + $rootScope.id + ' going to ' +
        //  JSON.stringify(toState.name));
      });
    }]);
})();
