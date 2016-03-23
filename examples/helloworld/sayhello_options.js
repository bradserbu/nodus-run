const _ = require('underscore');
const sayhello = require('./sayhello');

module.exports = function (name) {
    const options = this.__options;

    // ** Check whether we should capitalize the first letter
    if (options.capitalize)
        name = name.toUpperCase();

    return sayhello(name);
}
