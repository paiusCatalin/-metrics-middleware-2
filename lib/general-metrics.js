const client = require("prom-client");
const fs = require("fs");
const path = require("path");
const {removeDuplicates} = require("../utils");
const register = client.register;
const methodRegistryCounters = {};
const domainRegistryCounters = {};
register.setDefaultLabels({
    app: "wg-metrics"
});

const requestTimerMetric = new client.Histogram({
    name: "request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["action", "code", "domain", "method", "operation"],
    buckets: [0.1, 0.5, 1, 5] // 0.1 to 5 seconds
});

register.registerMetric(requestTimerMetric);

function handleRequestsForMetrics(request, response, next) {
    const {method, url} = request;
    /** Update the request method counter metric */
    _requestMethodCounter(method);

    const end = requestTimerMetric.startTimer();
    response.on("finish", () => {
        const urlParts = url.split("/");
        let action = url, domain = "default", operation = "generic-request";
        if (urlParts.length >= 4) {
            action = urlParts[1];
            domain = urlParts[2];
            operation = urlParts[3];
        }

        end({action, code: response.statusCode, domain, method, operation});
    });

    next();
}

function getStaticMetrics(rootFolder, currentStaticMetrics) {
    const domains = fs.readdirSync(rootFolder);
    let result = JSON.parse(JSON.stringify(currentStaticMetrics));
    result.domainsCount = domains.length;
    result.domains = removeDuplicates(currentStaticMetrics.domains, domains);
    domains.forEach(domain => {
        if (!result[domain]) {
            result[domain] = {anchorsCount: 0, bricksCount: 0};
        }

        result[domain] = _countContentForDomain(path.join(rootFolder, domain));
    });

    _updateStaticMetricCounts(result);
    return result;
}

async function sendLiveMetrics(req, res) {
    res.setHeader("Content-Type", register.contentType);
    res.send(200, await register.metrics());
}

function _countAnchors(srcPath) {
    const anchors = fs.readdirSync(srcPath);
    return anchors.length;
}

function _countBricks(srcPath) {
    let bricksCount = 0;
    const bricksLeadingFolders = fs.readdirSync(srcPath);
    bricksLeadingFolders.forEach(folder => {
        const bricks = fs.readdirSync(path.join(srcPath, folder));
        bricksCount += bricks.length;
    });

    return bricksCount;
}

function _countContentForDomain(srcPath) {
    const anchorsCount = _countAnchors(path.join(srcPath, "anchors"));
    const bricksCount = _countBricks(path.join(srcPath, "brick-storage"));

    return {anchorsCount, bricksCount};
}

function _updateStaticMetricCounts(staticMetrics) {
    staticMetrics.domains.forEach(domain => {
        console.log(domain, staticMetrics[domain]);
    });
}

function _requestMethodCounter(method) {
    if (!methodRegistryCounters[method]) {
        const counterMetric = new client.Counter({
            name: `${method.toLowerCase()}_count`, help: `Counter for ${method} method requests`
        });

        methodRegistryCounters[method] = counterMetric;
        register.registerMetric(counterMetric);
    }

    methodRegistryCounters[method].inc();
}

module.exports = {
    getStaticMetrics, sendLiveMetrics, handleRequestsForMetrics
};