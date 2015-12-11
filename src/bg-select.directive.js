(function() {
    'use strict';

    angular
        .module('greenflex.bgSelect', [])
        .directive('bgSelect', select);

    select.$inject = ['$rootScope', '$timeout', 'Restangular', '$q', '$injector'];

    function select($rootScope, $timeout, Restangular, $q, $injector) {

        return {
            restrict: 'A',
            scope: {
                'bgSelect': '=?',
                'ngModel': '=',
                'params': '=?'
            },
            link: function(scope, element, attrs) {

                var $translate;

                try {
                    $translate = $injector.get('translate');
                } catch(e){
                    $translate = { instant: function(str) { return str;} };
                }


                var field = 'label';
                if (angular.isDefined(attrs.field)) {
                    field = attrs.field;
                }

                var options = { plugins: ['remove_button']};
                var $select;
                var selectize;

                element.addClass('selectize');

                if (attrs.api) {

                    if (!angular.isDefined(attrs.placeholder)) {
                        element.attr('placeholder', $translate.instant('Rechercher ....'));
                    } else {
                        element.attr('placeholder', $translate.instant(attrs.placeholder));
                    }

                    var canceler = $q.defer();
                    var apiCallDone = true;

                    // add element from api
                    options.load = function(query, forceLoad) {
                        if (!query.length && !forceLoad) {
                            return;
                        }

                        var params = [];

                        // init params object (allow dynamic changes unlike param-)
                        if (scope.params) {
                            params = angular.copy(scope.params);
                        }

                        params[field] = query;

                        // Passing addition parameters prefixed by "param-"
                        angular.forEach(attrs, function(value, key) {
                            if (key.indexOf("param-") > -1) {
                                var paramkey = key.substring(5, key.length).toLowerCase();
                                params[paramkey] = value;
                            }
                        });

                        // Cancel that request if the previous was not finished
                        if (!apiCallDone) {
                            canceler.resolve();
                            canceler = $q.defer(); // new defer for the next request
                        }

                        apiCallDone = false;


                        Restangular.all(attrs.api).withHttpConfig({timeout: canceler.promise}).getList(params)
                            .then(function (options) {

                                if (options.length === 0) {
                                    //var result = {id: '-'};
                                    //result[field] = $translate.instant('Aucun résultat trouvé pour %value%').replace('%value%', query);
                                    //scope.bgSelect = [result];
                                } else {
                                    scope.bgSelect = options;
                                }

                                apiCallDone = true;
                            });
                    };

                    $select = element.selectize(options);
                    selectize = $select[0].selectize;

                    // we can't select "no result" text
                    selectize.on('change', function(val) {
                        if (val === '-') {
                            selectize.clearOptions();
                        }
                    });

                } else {

                    if (!angular.isDefined(attrs.placeholder)) {
                        element.attr('placeholder', $translate.instant('Choisir ....'));
                    } else {
                        element.attr('placeholder', $translate.instant(attrs.placeholder));
                    }

                    // add element
                    $select = element.selectize();
                    selectize = $select[0].selectize;
                }

                // set value from model, timeout to prevent digest error
                $timeout(function() {

                    if (scope.ngModel) {
                        if (angular.isDefined(scope.ngModel.id)) {
                            if (attrs.api) {
                                // in api mode (ajax call) we must preload the selected option
                                selectize.addOption({
                                    text: scope.ngModel[field],
                                    value: scope.ngModel.id
                                });
                            }

                            selectize.setValue(scope.ngModel.id);
                        } else {

                            if (attrs.api && scope.ngModel && !scope.bgSelect) {
                                // in api mode (ajax call) we must call the API to set the label
                                Restangular.all(attrs.api)
                                    .withHttpConfig({timeout: canceler.promise})
                                    .getList({id: scope.ngModel})
                                    .then(function (options) {
                                        var option = options[0];
                                        selectize.addOption({
                                            text: option[field],
                                            value: scope.ngModel
                                        });
                                        $timeout(function() {
                                            selectize.setValue(scope.ngModel);
                                        }, 0);
                                    });
                            } else {

                                var values = [];

                                if (angular.isObject(scope.ngModel)) {
                                    angular.forEach(scope.ngModel, function(value) {
                                        values.push(value.id);
                                    });
                                } else {
                                    if(angular.isString(scope.ngModel)) {
                                        values = scope.ngModel.split(',');
                                    } else {
                                        values = scope.ngModel;
                                    }
                                }

                                selectize.setValue(values);
                            }
                        }
                    }
                }, 0);


                // force options reload if params change
                scope.$watch(function() { return scope.params; }, function(newValue) {

                    // remove value (allow to clear options)
                    scope.ngModel = null;

                    if(newValue && options.load) {
                        options.load('', true);
                    }
                }, true);


                // apply model changes
                scope.$watch('ngModel', function (newValue) {
                    if(selectize) {

                        var values = [];

                        if (angular.isObject(newValue)) {
                            angular.forEach(newValue, function(value) {
                                values.push(value.id);
                            });
                        } else {
                            if(angular.isString(newValue)) {
                                values = newValue.split(',');
                            } else {
                                values = newValue;
                            }
                        }

                        $timeout(function () {
                            selectize.setValue(values);
                        }, 0);
                    }
                });

                // refresh selectize options on scope change
                scope.$watch('bgSelect', function(options) {

                    if (scope.ngModel === null || scope.ngModel === '') {
                        selectize.clearOptions();
                    }

                    angular.forEach(options, function(option) {
                        selectize.addOption({
                            text: option[field],
                            value: option.id
                        });

                        if (attrs.api) {
                            selectize.refreshOptions();
                        }
                    });

                });

            }
        };
    }

})();
