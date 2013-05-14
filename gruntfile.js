/*global module:true, require:true, jasmine: true*/
module.exports = function (grunt) {

    var taskConfig = {
        pkg: grunt.file.readJSON('package.json'),
        dirs: {
            tests: {
                js: "tests/js",
                php: "tests/php"
            },
            src_js: "js/",
            src_css: "css/"
        },

        csslint: {
            options: {
                'fallback-colors': 0,
                'box-sizing': 0,
                import: 0
            },
            app: {
                src: ['<%=dirs.src_css%>/**.css', '!<%=dirs.src_css%>/lib/**.css']
            }
        },

        jshint: {

            // Some typical JSHint options and globals
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                boss: true,
                eqnull: true,
                browser: true,
                expr: true,
                devel: true
            },

            gruntfile: {
                src: 'gruntfile.js'
            },

            app: {
                options: {
                    globals: {
                        browser: true,
                        define: true
                    }
                },
                src: [
                    '<%=dirs.src_js%>/**/*.js',
                    '!<%=dirs.src_js%>/lib/**/*.js'
                ]
            },

            tests: {
                options: {
                    globals: {
                        define: true,
                        jasmine: true,
                        it: true,
                        expect: true,
                        spyOn: true,
                        spyOnEvent: true,
                        loadFixtures: true,
                        beforeEach: true,
                        afterEach: true,
                        describe: true
                    }
                },
                src: [
                    '<%=dirs.tests.js%>/**/*.js',
                    '!<%=dirs.tests.js%>/vendor/**/*.js'
                ]
            }
        },

        jasmine: {
            options: {
                specs: '<%=dirs.tests.js%>/**/*_spec.js',
                vendor: '<%=dirs.tests.js%>/vendor/jasmine-jquery.js',
                template: require('grunt-template-jasmine-requirejs'),
                templateOptions: {
                    requireConfig: {
                        baseUrl: 'js',
                        paths: {
                            'underscore': 'lib/underscore-amd',
                            'backbone': 'lib/backbone-amd',
                            'jquery': 'lib/jquery',
                            'moment': 'lib/moment',
                            'spin': 'lib/spin'
                        },
                        shim: {
                            'lib/d3': {
                                exports: 'd3'
                            },
                            'lib/bootstrap': ['jquery'],
                            'lib/Uri': {
                                exports: 'Uri'
                            }
                        },
                        callback: function($) {
                            // Set up the fixtures
                            jasmine.getFixtures().fixturesPath = 'tests/js/fixtures';
                        }
                    }
                }
            },
            debug: {
                options: {
                    /* save the runner file for debugging */
                    keepRunner: 'true'
                }
            },
            app: {
                /* nothing new here */
            }
        },

        phplint: {
            app: {
                src: ['data/**/*.php', 'elements/**/*.php', 'templates/**/*.php', 'index.php']
            }
        },

        watch: {
            options: {
                interrupt: true
            },
            gruntfile: {
                files: ['<%=jshint.gruntfile.src%>'],
                tasks: ['jshint:gruntfile']
            },
            scripts: {
                files: ['<%=jshint.app.src%>', '<%=jasmine.options.specs%>'],
                tasks: ['jshint:app', 'jasmine:app']
            },
            styles: {
                files: ['<%=csslint.app.src%>'],
                tasks: ['csslint']
            },
            tests: {
                files: ['<%=jshint.tests.src%>'],
                tasks: ['jshint:tests', 'jasmine:app']
            },
            php: {
                files: ['<%=phplint.app.src%>'],
                tasks: ['phplint:app']
            }
        }
    };

    grunt.initConfig(taskConfig);


    // Load plugins here
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-csslint');

    grunt.loadNpmTasks('grunt-contrib-jasmine');

    grunt.loadNpmTasks('grunt-phplint');

    // Define your tasks here
    grunt.registerTask('default', ['phplint', 'jshint', 'csslint', 'jasmine:app']);
};
