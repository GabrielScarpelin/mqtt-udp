import * as dgram from "dgram";
import MqttUdpPacket from "./DTOs/PacketDto.js";
import Throttle from "./Throttle.js";
import PacketMapper from "./PacketMapper.js";
import { randomBytes } from "crypto";
import MqttPacketTypeEnum from "./enums/PacketTypeEnum.js";
import NetAddr from "./NetAddr.js";
class Client {
    client;
    topicsSubscribed = [];
    throttle;
    listenPort = 1883;
    broadcastAddress;
    nodeId = randomBytes(8).toString("hex");
    initiatedTime = null;
    node;
    packetsWaitingAck = {};
    pubAckTimeoutMs;
    functionForTopics = {};
    constructor({ packetThrottle, throttleTimeoutMs, isThrottlingDisabled = false, pubAckTimeoutMs = 5000, port = 1883, itemsConfigurable, node, }, callback) {
        this.pubAckTimeoutMs = pubAckTimeoutMs;
        this.listenPort = port;
        this.broadcastAddress = NetAddr.getBroadcastAddress();
        this.initiatedTime = new Date();
        this.node = node || {
            name: "Node " + this.nodeId,
            location: "Unknown",
        };
        for (const itemConfigurable of itemsConfigurable) {
            this.topicsSubscribed.push(`$SYS/conf/${this.nodeId}/${itemConfigurable.item}`);
            this.functionForTopics[`$SYS/conf/${this.nodeId}/${itemConfigurable.item}`] = itemConfigurable.function;
        }
        if (!isThrottlingDisabled) {
            this.throttle = new Throttle(packetThrottle, throttleTimeoutMs);
        }
        this.client = dgram.createSocket("udp4");
        this.client.bind(this.listenPort, callback);
        this.client.on("message", (msg, rinfo) => {
            if (msg.length > 268435455) {
                console.error("Packet too large");
                return;
            }
            if (this.throttle) {
                this.throttle.read(() => {
                    this._handleMessage(msg, rinfo);
                });
            }
            else {
                this._handleMessage(msg, rinfo);
            }
        });
    }
    subscribe(topic, onReceive, callback) {
        if (this.topicsSubscribed.includes(topic)) {
            return callback(new Error("Already subscribed to this topic"));
        }
        this.topicsSubscribed.push(topic);
        this.functionForTopics[topic] = onReceive;
    }
    sendMessage(mqttPacket) {
        if (this.throttle) {
            this.throttle.send(() => {
                this._sendMessage(mqttPacket);
            });
        }
        else {
            this._sendMessage(mqttPacket);
        }
    }
    sendPing(address, port) {
        if (this.throttle) {
            this.throttle.send(() => {
                this._sendPing(address, port);
            });
        }
        else {
            this._sendPing(address, port);
        }
    }
    _sendMessage(mqttPacket, port = 1883, address = this.broadcastAddress) {
        console.log("Packets waiting ack: ", this.packetsWaitingAck);
        const packet = PacketMapper.generatePacketBuffer(mqttPacket, this.packetsWaitingAck);
        if (mqttPacket.getPacketId()) {
            this.packetsWaitingAck[mqttPacket.getPacketId()] = {
                packet,
                intervalId: null,
                retries: 0,
            };
        }
        this.client.send(packet, port, address, (err) => {
            if (err) {
                console.error(err);
            }
        });
        mqttPacket.getQos() > 0 &&
            this._startPubackTimeout(packet, mqttPacket.getPacketId(), port, this.broadcastAddress);
    }
    _handleMessage(msg, rinfo) {
        if (rinfo.address === NetAddr.getLocalIp() &&
            rinfo.port === this.listenPort)
            return;
        const packetType = msg.readUInt4(0);
        switch (packetType) {
            case 3:
                this._receivePublishMessage(msg, rinfo);
                break;
            case 4:
                this._receivePubAck(msg);
                break;
            case 8:
                this._sendConfigurableItemsOrPredefined(msg, rinfo.address, rinfo.port);
                break;
            case 12:
                this._sendPingResponse(rinfo);
                break;
            case 13:
                this._receivePingResponse();
                break;
            default:
                console.log(`Received unknown packet type ${packetType}`);
        }
    }
    _receivePublishMessage(msg, rinfo) {
        try {
            const { packet, packetId } = PacketMapper.parsePublishMessage(msg);
            const hasSubscribed = this._checkTopicAndReturnSubscribed(packet.getTopic());
            if (hasSubscribed) {
                if (packetId && packet.getQos() > 0) {
                    this._sendPubAck(packetId, rinfo);
                }
                this.functionForTopics[hasSubscribed](packet);
            }
        }
        catch (error) {
            console.error("Error processing publish message:", error);
        }
    }
    _receivePubAck(msg) {
        const packetId = msg.readUInt16BE(1);
        if (this.packetsWaitingAck[packetId]) {
            clearInterval(this.packetsWaitingAck[packetId].intervalId);
            delete this.packetsWaitingAck[packetId];
        }
        else {
            console.error("Received PUBACK for unknown packet ID");
        }
    }
    _receivePingResponse() {
        console.log("Ping response received");
    }
    _sendPingResponse(rinfo) {
        const sendPacket = () => {
            const packet = Buffer.from([0xd0, 0x00]);
            this.client.send(packet, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.error(err);
                }
                console.log("Ping response sent successfully");
            });
        };
        if (this.throttle) {
            this.throttle.send(sendPacket);
        }
        else {
            sendPacket();
        }
    }
    _sendPing(address, port) {
        const packet = Buffer.from([0xc0, 0x00]);
        this.client.send(packet, port, address, (err) => {
            if (err) {
                console.error(err);
            }
            console.log("Ping sent successfully");
        });
    }
    _sendPubAck(packetId, rinfo) {
        const packet = Buffer.from([0x40, 0x02]);
        packet.writeUInt16BE(packetId, 2);
        this.client.send(packet, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error(err);
                return;
            }
        });
    }
    _startPubackTimeout(packet, packetId, port, ip) {
        const timeout = setTimeout(() => {
            if (this.packetsWaitingAck[packetId]) {
                const secondNibble = packet.readUInt4(1);
                const setDup = secondNibble | 0x08;
                packet.writeUInt4(setDup, 1);
                this.client.send(packet, port, ip, (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    console.log("Resending message retries:", this.packetsWaitingAck[packetId].retries, "Packet Buffer: ", packet);
                });
                if (this.packetsWaitingAck[packetId].retries < 5) {
                    this._startPubackTimeout(packet, packetId, port, ip);
                    this.packetsWaitingAck[packetId].retries++;
                }
                this.packetsWaitingAck[packetId].intervalId = null;
            }
        }, this.pubAckTimeoutMs);
        this.packetsWaitingAck[packetId].intervalId = timeout;
    }
    _checkTopicAndReturnSubscribed(topic) {
        // Wildcard check
        for (const subscribedTopic of this.topicsSubscribed) {
            if (this._matchTopic(subscribedTopic, topic)) {
                return subscribedTopic;
            }
        }
        return null;
    }
    _matchTopic(subscribedTopic, topic) {
        if (subscribedTopic === topic)
            return true;
        const subscribedLevels = subscribedTopic.split("/");
        const topicLevels = topic.split("/");
        for (let i = 0; i < subscribedLevels.length; i++) {
            const subLevel = subscribedLevels[i];
            // Se acabaram os níveis do tópico, mas não do tópico inscrito
            if (i >= topicLevels.length) {
                if (subLevel === "#") {
                    return true;
                }
                return null;
            }
            const topicLevel = topicLevels[i];
            if (subLevel === "#") {
                return true; // "#" corresponde a todos os níveis restantes
            }
            else if (subLevel !== "+" && subLevel !== topicLevel) {
                return false; // Nível não corresponde e não é um curinga
            }
        }
        // Se `topic` tem mais níveis do que `subscribedTopic`
        if (topicLevels.length > subscribedLevels.length) {
            if (subscribedLevels[subscribedLevels.length - 1] !== "#") {
                return false;
            }
        }
        return true;
    }
    _sendConfigurableItemsOrPredefined(msg, address, port) {
        const { packet: receivedPacket } = PacketMapper.parsePublishMessage(msg);
        const topic = receivedPacket.getTopic();
        const isPredefinedTopicString = this._verifyPredefinedTopicAndSendResponseText(topic);
        console.log("isPredefinedTopicString", isPredefinedTopicString);
        if (isPredefinedTopicString !== "UNKNOWN") {
            const packet = PacketMapper.generatePacketBuffer(new MqttUdpPacket({
                topic,
                message: isPredefinedTopicString,
                qos: 0,
                packetType: MqttPacketTypeEnum.PUBLISH,
            }), {});
            this.client.send(packet, port, address, (err) => {
                if (err)
                    console.error(err);
            });
            return;
        }
        console.log("Sending configurable items");
        for (let topicSubscribed of this.topicsSubscribed) {
            const topic = topicSubscribed.split("/");
            if (topic[0] === "$SYS" &&
                topic[1] === "conf" &&
                topic[2] === this.nodeId) {
                const packet = PacketMapper.generatePacketBuffer(new MqttUdpPacket({
                    topic: topicSubscribed,
                    message: "NEED_CONFIG",
                    qos: 0,
                    packetType: MqttPacketTypeEnum.PUBLISH,
                }), {});
                this.client.send(packet, 1883, this.broadcastAddress, (err) => {
                    if (err)
                        console.error(err);
                });
            }
        }
    }
    _verifyPredefinedTopicAndSendResponseText(topic) {
        switch (topic) {
            case "$SYS/conf/${this.nodeId}/info/ver":
                return "1.0.0";
            case "$SYS/conf/${this.nodeId}/info/soft":
                return "NODEJS-MQTT-UDP";
            case "$SYS/conf/${this.nodeId}/node/name":
                return this.node.name;
            case "$SYS/conf/${this.nodeId}/node/location":
                return this.node.location;
            case "$SYS/conf/${this.nodeId}/net/mac":
                return NetAddr.getMacAddress();
            case "$SYS/conf/${this.nodeId}/net/ip":
                return NetAddr.getLocalIp();
            case "$SYS/conf/${this.nodeId}/info/uptime":
                const requestedDate = new Date();
                const uptime = requestedDate.getTime() - this.initiatedTime.getTime();
                const uptimeTextFormat = new Date(uptime).toISOString();
                return uptimeTextFormat;
            default:
                return "UNKNOWN";
        }
    }
}
export default Client;
//# sourceMappingURL=Client.js.map