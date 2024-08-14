class MqttUdpPacket {
    packetType;
    topic;
    message;
    qos;
    rinfo;
    constructor({ packetType, topic, message, qos, rinfo, }) {
        this.packetType = packetType;
        this.topic = topic;
        this.message = message;
        this.qos = qos;
        this.rinfo = rinfo;
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
}
export default MqttUdpPacket;
//# sourceMappingURL=PacketDto.js.map