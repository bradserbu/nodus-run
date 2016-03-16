#!/usr/bin/env node
'use strict';

// ** Program Options
const DEFAULT_OPTIONS = {
    loglevel: 'info',
    newline: true,
    print_undefined: false,
    print_null: false
};

// ** Dependencies
const _ = require('underscore');
const extend = require('extend');
const util = require('util');
const yargs = require('yargs');

// ** Platform
const errors = require('nodus').errors;
const logger = require('nodus').logger;
const files = require('nodus').files;

/**
 * Print the JSON representation of a value considering the optional newline value
 * @param value - The value to stringify
 */
function stringify(value) {
    if (options.newline)
        return JSON.stringify(value, null, 2);

    return JSON.stringify(value);
}

/**
 * Checks if the value supplied is a promise.
 * @param value
 */
function isPromise(value) {
    return util.isFunction(value.then);
}

/**
 * Print an error to the output stream.
 * @param err
 */
function print_error(err) {
    // ** Print the error and exit
    console.error(err);
}

/**
 * Display an error or a result to the output.
 * @param err
 * @param result
 */
function print(result) {
    // ** Print the value and exit
    console.log(stringify(result));
    //console.log(util.inspect(result));
}

function $run(func) {
    const result = func();

    // ** Wait for the promise to complete before exiting
    if (isPromise(result)) {
        // ** Wait for the result, then print it
        return result;
    } else {
        return Promise.resolve(result);
    }
}

// ** Parse the commandline arguments.
const argv = yargs.argv;

// ** Load the program options.
const options = extend(true, {}, DEFAULT_OPTIONS, argv);
if (argv.hasOwnProperty('newline')) options.newline = argv.newline;
if (argv.hasOwnProperty('print_undefined')) options.print_undefined = argv.newline;
if (argv.hasOwnProperty('print_null')) options.print_null = argv.print_null;

// ** Load the program arguments.
const parameters = _.clone(argv._);
const program = parameters.shift();
const command = parameters.shift();

// ** Build object from name=value pairs
const args = {};
_.each(parameters, arg => {
    // ** Get the name of the argument
    const name = arg.split('=')[0];

    // ** Get the value to set it to
    let value;
    const index_of_equal_sign = arg.indexOf('=');
    if (index_of_equal_sign !== -1)
        value = arg.substring(index_of_equal_sign + 1);

    args[name] = value;
});

// ** Load the application
const app = files.requireFile(program);

// ** Run the exported function
if (app.hasOwnProperty(command) === false) throw errors('COMMAND_NOT_FOUND', {command: command}, `The command ${command} could not be found in the programs exports.`);


