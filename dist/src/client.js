import * as dgram from "dgram";
import MqttUdpPacket from "./DTOs/PacketDto.js";
import RemainingLengthOversized from "./expection/RemainingLengthOversized.js";
import MqttPacketTypeEnum from "./enums/PacketTypeEnum.js";
import Throttle from "./Throttle.js";
class Client {
    client;
    topicsSubscribed = [];
    throttle;
    functionForTopics = {};
    constructor({ packetThrottle, throttleTimeoutMs, isThrottlingDisabled = false, }, callback) {
        if (!isThrottlingDisabled) {
            this.throttle = new Throttle(packetThrottle, throttleTimeoutMs);
        }
        this.client = dgram.createSocket("udp4");
        this.client.bind(1883, callback);
        this.client.on("message", (msg, rinfo) => {
            const packetType = msg.readUInt4(0);
            if (packetType === 3) {
                this._receiveMessage(msg, rinfo);
            }
        });
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
    subscribe(topic, onReceive, callback) {
        if (this.topicsSubscribed.includes(topic)) {
            return callback(new Error("Already subscribed to this topic"));
        }
        this.topicsSubscribed.push(topic);
        this.functionForTopics[topic] = onReceive;
        const topicBuffer = Buffer.from(topic);
        const packet = Buffer.alloc(2 + topicBuffer.length);
        packet.writeUInt4(3, 0);
        packet.writeUInt4(0, 1);
        packet.writeUInt8(topicBuffer.length, 1);
        topicBuffer.copy(packet, 2);
        this.client.send(packet, 1883, "localhost", callback);
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
    _sendMessage(mqttPacket) {
        const topicBuffer = Buffer.from(mqttPacket.getTopic());
        const messageBuffer = Buffer.from(mqttPacket.getMessage());
        const payloadLength = topicBuffer.length + messageBuffer.length + 2;
        const bytesPayloadLength = this._generateVariableByteInteger(payloadLength);
        const packet = Buffer.alloc(1 + bytesPayloadLength.length + payloadLength);
        packet.writeUInt4(3, 0);
        packet.writeUInt4(0, 1);
        bytesPayloadLength.copy(packet, 1);
        packet.writeUInt16BE(topicBuffer.length, 1 + bytesPayloadLength.length);
        topicBuffer.copy(packet, bytesPayloadLength.length + 3);
        messageBuffer.copy(packet, 3 + bytesPayloadLength.length + topicBuffer.length);
        this.client.send(packet, 1883, "10.254.23.255", (err) => {
            if (err) {
                console.error(err);
            }
            console.log("Message sent successfully to IP: 60391");
        });
    }
    _readVariableBytePayloadLength(packet) {
        let bytesRead = 0;
        let multiplier = 1;
        let result = 0;
        let byte = 0;
        do {
            if (bytesRead >= 4) {
                throw new RemainingLengthOversized();
            }
            byte = packet.readUInt8(bytesRead + 1);
            result += (byte & 0x7f) * multiplier;
            multiplier *= 128;
            bytesRead++;
        } while ((byte & 0x80) !== 0);
        return [result, bytesRead];
    }
    _receiveMessage(msg, rinfo) {
        const [payloadLength, bytesRead] = this._readVariableBytePayloadLength(msg);
        const topicLengthHi = msg.readUint8(1 + bytesRead);
        const topicLengthLo = msg.readUint8(2 + bytesRead);
        const topicLength = (topicLengthHi << 8) | topicLengthLo;
        const topic = msg.toString("utf-8", 3 + bytesRead, 3 + bytesRead + topicLength);
        console.log(`Received message from topic ${topic}`);
        const hasSubscribed = this._checkTopicAndReturnSubscribed(topic);
        if (hasSubscribed) {
            const messageLength = payloadLength - topicLength - 2 - bytesRead - 1;
            const message = msg.toString("utf-8", 3 + bytesRead + topicLength, 3 + bytesRead + topicLength + messageLength);
            const packet = new MqttUdpPacket({
                packetType: MqttPacketTypeEnum.PUBLISH,
                topic,
                message,
                rinfo,
                qos: 0,
            });
            this.functionForTopics[hasSubscribed](packet);
        }
    }
    _generateVariableByteInteger(value) {
        const uint8Array = new Uint8Array(4);
        let remainingValue = value;
        let byte = 0;
        let i = 0;
        do {
            byte = remainingValue % 128;
            remainingValue = Math.floor(remainingValue / 128);
            if (remainingValue > 0) {
                byte = byte | 0x80;
            }
            uint8Array[i] = byte;
            i++;
        } while (remainingValue > 0);
        return Buffer.from(uint8Array.slice(0, i));
    }
}
export default Client;
//# sourceMappingURL=client.js.map