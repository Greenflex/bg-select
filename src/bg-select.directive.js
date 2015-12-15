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
                'bgSelect': '=',
                'ngModel': '=',
                'ngModelValue': '=',
                'params': '=',
                'ngDisabled': '=',
                'disableParamsWatch': '='
            },
            link: function(scope, element, attrs) {

                if (!angular.isDefined(element)) {
                    return;
                }

                /**
                 * Load select data form a query (autocomplete)
                 * @param  {string} query      search query
                 * @param  {boolean} forceLoad force autocomplete even if the query is empty
                 * @return {void}
                 */
                function apiLoad (query, forceLoad) {
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
                        if (key.indexOf('param-') > -1) {
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
                            scope.bgSelect = options;
                            apiCallDone = true;
                        });
                }

                /**
                 * Format options for selctize
                 * @param  {array} options raw options
                 * @return {array} formatted options
                 */
                function getSelectizeOptions(options)
                {
                    var selectizeOptions = [];

                    angular.forEach(options, function(option) {
                        selectizeOptions.push({
                            text: option[field],
                            value: option.id
                        });
                    });

                    return selectizeOptions;
                }

                /**
                 * Refresh selection options
                 * @param {array} options List of options
                 * @return {void}
                 */
                function refreshOptions(options, oldOptions)
                {
                    // prevent not wanted refresh (this event can be triggered even if the value hasn't changed)
                    if (options === oldOptions) {
                        return;
                    }

                    if (angular.isDefined(options) && angular.isDefined(oldOptions)) {
                        selectize.clearOptions();
                    }

                    // add manually new options
                    var selectizeOptions = getSelectizeOptions(options);

                    angular.forEach(selectizeOptions, function(option) {
                        selectize.addOption(option);
                    });

                    if (attrs.api) {
                        selectize.refreshOptions();
                    }
                }

                // start
                var $translate;
                var options = {
                    plugins: ['remove_button'],
                    render: {
                        // prevent empty option
                        option: function(item, escape) {
                            if (item.text) {
                                return '<div>' + escape(item.text) + '</div>';
                            } else {
                                return '';
                            }
                        }
                    }
                };
                var $select;
                var selectize;

                try {
                    $translate = $injector.get('translate');
                } catch (e) {
                    $translate = {instant: function(str) { return str;}};
                }

                var field = 'label';
                if (angular.isDefined(attrs.field)) {
                    field = attrs.field;
                }

                if (attrs.api) {

                    if (!angular.isDefined(attrs.placeholder)) {
                        element.attr('placeholder', $translate.instant('Rechercher ....'));
                    } else {
                        element.attr('placeholder', $translate.instant(attrs.placeholder));
                    }

                    var canceler = $q.defer();
                    var apiCallDone = true;

                    // add element from api
                    options.load = apiLoad;

                    // init default values
                    options.options = getSelectizeOptions(scope.bgSelect);

                    $select = element.selectize(options);
                    selectize = $select[0].selectize;

                } else {

                    if (!angular.isDefined(attrs.placeholder)) {
                        element.attr('placeholder', $translate.instant('Choisir ....'));
                    } else {
                        element.attr('placeholder', $translate.instant(attrs.placeholder));
                    }

                    // add element
                    $select = element.selectize(options);
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
                                    if (angular.isString(scope.ngModel)) {
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

                // apply model changes
                scope.$watch('ngModel', function (newValue) {
                    if (selectize) {
                        var values = [];
                        if (angular.isObject(newValue)) {
                            angular.forEach(newValue, function(value) {
                                values.push(value.id);
                            });
                        } else {
                            if (angular.isString(newValue)) {
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

                // force options reload if params change
                scope.$watch('params', function(newValue, oldValue) {
                    if (angular.isDefined(newValue) && newValue !== oldValue) {

                        // params watch disabled ? (this is very useful for linked selects)
                        if (scope.disableParamsWatch) {
                            scope.disableParamsWatch = false;
                            return;
                        }

                        // remove value (allow to clear options)
                        scope.ngModel = null;
                        if (newValue && options.load) {
                            apiLoad('', true);
                        }
                    }
                }, true);

                // refresh selectize options on scope change
                scope.$watch('bgSelect', refreshOptions);
            }
        };
    }

})();
