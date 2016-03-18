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
const functions = require('nodus').functions;
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

function $command(func) {
    const info = functions.getFunctionInfo(func);

    // ** Function will call callback directly
    return (args, options) => new Promise((resolve, reject) => {

        // ** Map named arguments to an argument array
        const arg_array = functions.mapNamedArgs(args, info.paramList);

        // ** Add the callback to the argument list and invoke the function
        if (info.hasCallback) {
            logger.warn('FUNC: Has a callback...');
            arg_array.push((err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        }

        // ** Determine the context of the command
        const context = {
            __args: args,
            __options: options,
        };

        // ** Call the function with the 'this' argument injected with args/options
        const result = func.apply(context, arg_array);
        resolve(result);
    });
}

/**
 * Run a command.
 * @param func
 * @returns {*}
 */
function $run(func, args, options) {

    // ** Argument defaults
    args = args || {};
    options = options || {};

    // ** Build a command
    const command = $command(func);

    // ** Run the command
    const result = command(args, options);

    // ** Wait for the promise to complete before exiting
    return isPromise(result) ? result : Promise.resolve(result);
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

// ** Build object from name=value pairs
const parse_arguments = () => {
    const args = {};
    _.forEach(parameters, arg => {
        // ** Get the name of the argument
        const name = arg.split('=')[0];

        // ** Get the value to set it to
        let value;
        const index_of_equal_sign = arg.indexOf('=');
        if (index_of_equal_sign !== -1)
            value = arg.substring(index_of_equal_sign + 1);

        args[name] = value;
    });

    return args;
};

// ** Load the application
const program_name = parameters.shift();

// ** Load the program
if (!program_name) throw errors('ARGUMENT_REQUIRED', 'program', '"program" is a required argument.');

const program = files.requireFile(program_name);

// ** Run the application
if (util.isFunction(program)) {
    // ** Parse the remaining entries on the command line
    const args = parse_arguments();

    // ** If the app itself is a function, then let's run that directly
    $run(program, args, options)
        .catch(print_error)
        .then(print);
} else {

    // ** Extract the name of the command
    const command_name = parameters.shift();

    // ** Now get the argument list

    // ** Run a function/command
    if (!command_name)
        throw errors('ARGUMENT_REQUIRED', 'command', '"command" is a required argument.');

    // ** Load the command
    const command = program[command_name];
    if (!command)
        throw errors('COMMAND_NOT_FOUND', {command: command},
            `The command "${command}" could not be found in the programs exports.`);

    // ** Parse the remaining entries on the command line
    const args = parse_arguments();

    // ** Run the command
    $run(command, args, options)
        .catch(print_error)
        .then(print);
}