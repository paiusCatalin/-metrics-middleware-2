const middlewares = require("./middlewares");

function getRequestDuration(start) {
    const diff = process.hrtime(start);
    return (diff[0] * 1e9 + diff[1]) / 1e6;
}

function removeDuplicates(arr1 = [], arr2 = []) {
    arr2 = arr2.filter((it2) => arr1.findIndex(it1 => it1.name === it2.name) === -1);
    return arr1.concat(arr2)
}

module.exports = {
    middlewares,
    getRequestDuration,
    removeDuplicates
};