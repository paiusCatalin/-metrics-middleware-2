const client = require("prom-client");
const {getRequestDuration} = require("../utils");
const register = client.register;

const brickingRequestsMetric = new client.Histogram({
    name: "bricking_duration_seconds",
    help: "Bricking requests metrics",
    labelNames: ["action", "code", "domain", "method", "operation", "responseTime"],
    buckets: [0.1, 0.5, 1, 5] // 0.1 to 5 seconds
});

register.registerMetric(brickingRequestsMetric);

function brickingMetricsHandler(request, response, next) {
    const {method, url} = request;
    const urlSegments = url.split("/");
    if (urlSegments.length < 4) {
        return null;
    }

    const action = urlSegments[1], domain = urlSegments[2], operation = urlSegments[3];
    const start = process.hrtime();
    const end = brickingRequestsMetric.startTimer();
    response.on("finish", () => {
        const responseTime = getRequestDuration(start);
        end({action, code: response.statusCode, domain, method, operation, responseTime});
        console.log("[BRICKING]", action, response.statusCode, domain, method, operation, responseTime, "ms");
    });

    next();
}

module.exports = {
    brickingMetricsHandler
};