function testMatchTopic() {
    const tests = [
        {
            subscribedTopic: "home/sensor/temperature",
            topic: "home/sensor/temperature",
            expected: "home/sensor/temperature",
        },
        {
            subscribedTopic: "home/+/temperature",
            topic: "home/livingroom/temperature",
            expected: "home/+/temperature",
        },
        {
            subscribedTopic: "home/sensor/#",
            topic: "home/sensor/temperature/extra",
            expected: "home/sensor/#",
        },
        {
            subscribedTopic: "home/sensor/#",
            topic: "home/sensor",
            expected: "home/sensor/#",
        },
        {
            subscribedTopic: "home/sensor",
            topic: "home/sensor/extra",
            expected: null,
        },
        { subscribedTopic: "home/+", topic: "home", expected: null },
        { subscribedTopic: "home/#", topic: "home", expected: "home/#" },
        {
            subscribedTopic: "home/+/humidity",
            topic: "home/livingroom/humidity",
            expected: "home/+/humidity",
        },
        {
            subscribedTopic: "home/+/humidity",
            topic: "home/livingroom/temperature",
            expected: null,
        },
        {
            subscribedTopic: "home/+/humidity/#",
            topic: "home/livingroom/humidity/level1/level2",
            expected: "home/+/humidity/#",
        },
    ];
    tests.forEach((test, index) => {
        const result = matchTopic(test.subscribedTopic, test.topic);
        console.log(`Test ${index + 1}: `, result === test.expected
            ? "Passed"
            : `Failed (expected ${test.expected}, got ${result})`);
    });
}
function matchTopic(subscribedTopic, topic) {
    if (subscribedTopic === topic)
        return subscribedTopic;
    const subscribedLevels = subscribedTopic.split("/");
    const topicLevels = topic.split("/");
    for (let i = 0; i < subscribedLevels.length; i++) {
        const subLevel = subscribedLevels[i];
        // Se acabaram os níveis do tópico, mas não do tópico inscrito
        if (i >= topicLevels.length) {
            if (subLevel === "#") {
                return subscribedTopic;
            }
            return null;
        }
        const topicLevel = topicLevels[i];
        if (subLevel === "#") {
            return subscribedTopic; // "#" corresponde a todos os níveis restantes
        }
        else if (subLevel !== "+" && subLevel !== topicLevel) {
            return null; // Nível não corresponde e não é um curinga
        }
    }
    // Se `topic` tem mais níveis do que `subscribedTopic`
    if (topicLevels.length > subscribedLevels.length) {
        if (subscribedLevels[subscribedLevels.length - 1] !== "#") {
            return null;
        }
    }
    return subscribedTopic;
}
testMatchTopic();
//# sourceMappingURL=_matchTopic.js.map