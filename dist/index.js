import { Buffer } from "buffer";
import Client from "./src/client.js";
import MqttUdpPacket from "./src/DTOs/PacketDto.js";
import MqttPacketTypeEnum from "./src/enums/PacketTypeEnum.js";
Buffer.prototype.writeUInt4 = function (value, uInt4Offset = 0) {
    const offset = Math.floor(uInt4Offset / 2);
    if (offset > this.length)
        throw new Error("Offset is out of bounds.");
    if (uInt4Offset % 2 === 0) {
        this[offset] = (this[offset] & 0b00001111) | ((value & 0b00001111) << 4);
    }
    else {
        this[offset] = (this[offset] & 0b11110000) | (value & 0b00001111);
    }
    return this;
};
Buffer.prototype.readUInt4 = function (uInt4Offset = 0) {
    const offset = Math.floor(uInt4Offset / 2);
    if (offset > this.length)
        throw new Error("Offset is out of bounds.");
    if (uInt4Offset % 2 === 0) {
        return (this[offset] & 0b11110000) >> 4;
    }
    return this[offset] & 0b00001111;
};
const mqtt = new Client({
    isThrottlingDisabled: false,
    packetThrottle: 10,
    throttleTimeoutMs: 1000,
});
mqtt.subscribe("home/room/light", (message) => {
    console.log("Acender ou apagar a luz da sala. Mensagem:", message);
    mqtt.sendMessage(new MqttUdpPacket({
        packetType: MqttPacketTypeEnum.PUBLISH,
        topic: "house/home/light",
        message: "turn off",
        qos: 0,
    }));
}, (err) => {
    if (err) {
        console.log(`Error subscribing to topic: ${err}`);
    }
    else {
        console.log("Subscribed to topic");
    }
});
mqtt.subscribe("home/kitchen/light", (message) => {
    console.log("Acender ou apagar a luz da cozinha. Mensagem:", message);
}, (err) => {
    if (err) {
        console.log(`Error subscribing to topic: ${err}`);
    }
    else {
        console.log("Subscribed to topic");
    }
});
const newPacket = new MqttUdpPacket({
    packetType: MqttPacketTypeEnum.PUBLISH,
    topic: "home/room/light",
    message: "turn on",
    qos: 0,
});
//# sourceMappingURL=index.js.map