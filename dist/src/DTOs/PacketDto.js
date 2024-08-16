class MqttUdpPacket {
    packetType;
    topic;
    message;
    qos;
    rinfo;
    packetId;
    constructor({ packetType, topic, message, qos, }) {
        this.packetType = packetType;
        this.topic = topic;
        this.message = message;
        this.qos = qos || 0;
    }
    // Getters
    getPacketType() {
        return this.packetType;
    }
    getTopic() {
        return this.topic;
    }
    getMessage() {
        return this.message;
    }
    getQos() {
        return this.qos;
    }
    getRinfo() {
        return this.rinfo;
    }
    getPacketId() {
        return this.packetId;
    }
    // Setters
    setPacketType(packetType) {
        this.packetType = packetType;
    }
    setTopic(topic) {
        this.topic = topic;
    }
    setMessage(message) {
        this.message = message;
    }
    setQos(qos) {
        this.qos = qos;
    }
    setRinfo(rinfo) {
        this.rinfo = rinfo;
    }
    setPacketId(packetId) {
        if (this.packetId > 65535 || this.packetId < 1) {
            throw new Error("Packet ID must be between 1 and 65535");
        }
        this.packetId = packetId;
    }
}
export default MqttUdpPacket;
//# sourceMappingURL=PacketDto.js.map