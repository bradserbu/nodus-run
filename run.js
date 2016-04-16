#!/usr/bin/env node
'use strict';

// ** Program Options
const DEFAULT_OPTIONS = {
    loglevel: 'info',
    newline: true
};

// ** Dependencies
const _ = require('underscore');
const $ = require('highland');
const Q = require('Q');
const extend = require('extend');
const util = require('util');
const yargs = require('yargs');
const ora = require('ora');

// ** Platform
const functions = require('nodus-framework').functions;
const errors = require('nodus-framework').errors;
const logger = require('nodus-framework').logging.createLogger();
const files = require('nodus-framework').files;

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
 * Returns if a value is a readable stream
 * @param value
 * @returns {*}
 */
function isStream(value) {
    return util.isFunction(value.pipe);
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
    if (isStream(result)) {
        // ** Print all the results in the stream as an array
        $(result)
        // .errors(err => print_error(err))
            .toArray(result => print(result));
    } else {
        // ** Print the value and exit
        console.log(stringify(result));
    }
}

/**
 * Create a function that can be called using named arguments
 * @param func
 * @returns {function(): Promise}
 */
function $command(func) {
    const info = functions.getFunctionInfo(func);

    // ** Function will call callback directly
    return (args, options) => new Promise((resolve, reject) => {

        // ** Map named arguments to an argument array
        const arg_array = _.isArray(args) ? args : functions.mapNamedArgs(args, info.paramList);

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
function run(func, args, options) {

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

/**
 * Run a program and then exit
 * @param program
 * @param options
 * @returns {Promise.<TResult>}
 */
function execute(program, options) {
    // ** Parse the remaining entries on the command line
    const args = extract_arguments();

    // ** Check if we should stream input from stdin
    // if (options.stdin) {
    //     // ** Pass each line of the input as input to the command
    //     return $(process.stdin)
    //         .map(line => console.log('LINE:', line));
    // } else {
    // ** If the app itself is a function, then let's run that directly

    let process = run(program, args, options);

    // ** Add spinner to the process
    if (require('tty').isatty(1)) {
        const spinner = ora('Running...');
        spinner.start();

        process = process.then(results => {
            spinner.stop();
            return results;
        });
    }


    return Q
        .when(process)
        .catch(print_error)
        .then(print);
    // }
}

// ** Parse the commandline arguments.
const argv = yargs.argv;

// ** Load the program options.
const options = extend(true, {}, DEFAULT_OPTIONS, argv);
if (argv.hasOwnProperty('newline')) options.newline = argv.newline;

// ** Load the program arguments.
const parameters = _.clone(argv._);

// ** Build object from name=value pairs
const extract_arguments = () => {
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
if (util.isFunction(program)) {
    return execute(program, options);
}

// ** Extract the name of the command
const command_name = parameters.shift();

// ** Load the command
const command = program[command_name];
if (!command)
    throw errors('COMMAND_NOT_FOUND', {command: command},
        `The command "${command}" could not be found in the programs exports.`);

// ** Run the command
return execute(command, options);