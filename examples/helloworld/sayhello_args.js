const sayhello = require('./sayhello');

module.exports = function () {
    const args = this.__args;

    const first_name = args.first_name || '';
    const last_name = args.last_name || '';

    return sayhello(`${first_name} ${last_name}`);
};