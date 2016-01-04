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
                 * Format options for selectize
                 * @param  {array} options raw options
                 * @return {array} formatted options
                 */
                function getSelectizeOptions(options)
                {
                    var selectizeOptions = [];

                    angular.forEach(options, function(option) {
                        if (option[field].trim() !== '') {
                            selectizeOptions.push({
                                text: option[field],
                                value: option[value]
                            });
                        }
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

                    if (angular.isDefined(options) && angular.isDefined(oldOptions) && !attrs.multiple) {
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

                /**
                 * Event trigger on ngModel change
                 * @param  {string} newValue
                 * @param  {string} oldValue
                 * @return {void}
                 */
                function onModelChange(newValue, oldValue)
                {
                    // prevent not wanted changes
                    if (newValue === oldValue) {
                        return;
                    }

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
                }

                /**
                 * Event trigger on params change
                 * @param  {array} newValue
                 * @param  {array} oldValue
                 * @return {void}
                 */
                function onParamsChange(newValue, oldValue)
                {
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
                }

                var field = 'label';
                if (angular.isDefined(attrs.field)) {
                    field = attrs.field;
                }

                var value = 'id';
                if (angular.isDefined(attrs.value)) {
                    value = attrs.value;
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
                    },
                    options :  getSelectizeOptions(scope.bgSelect)
                };

                // limit max items
                if (!attrs.multiple) {
                    options.maxItems = 1;
                }

                try {
                    $translate = $injector.get('translate');
                } catch (e) {
                    $translate = {instant: function(str) { return str;}};
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

                } else {
                    if (!angular.isDefined(attrs.placeholder)) {
                        element.attr('placeholder', $translate.instant('Choisir ....'));
                    } else {
                        element.attr('placeholder', $translate.instant(attrs.placeholder));
                    }

                }

                // add element
                var $select = element.selectize(options);
                var selectize = $select[0].selectize;

                // set value from model, timeout to prevent digest error
                $timeout(function() {
                    if (scope.ngModel) {
                        // if ngModel is an object (not working with params feature)
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
                                // this is an "emergency" call, values should be prefilled inside scope.bgSelect
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
                    } else {
                        // no model defined
                    }
                }, 0);

                // apply model changes
                scope.$watch('ngModel', onModelChange);

                // force options reload if params change
                scope.$watch('params', onParamsChange, true);

                // refresh selectize options on scope change
                scope.$watch('bgSelect', refreshOptions);
            }
        };
    }

})();
