var MqttPacketTypeEnum;
(function (MqttPacketTypeEnum) {
    MqttPacketTypeEnum[MqttPacketTypeEnum["CONNECT"] = 1] = "CONNECT";
    MqttPacketTypeEnum[MqttPacketTypeEnum["CONNACK"] = 2] = "CONNACK";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PUBLISH"] = 3] = "PUBLISH";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PUBACK"] = 4] = "PUBACK";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PUBREC"] = 5] = "PUBREC";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PUBREL"] = 6] = "PUBREL";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PUBCOMP"] = 7] = "PUBCOMP";
    MqttPacketTypeEnum[MqttPacketTypeEnum["SUBSCRIBE"] = 8] = "SUBSCRIBE";
    MqttPacketTypeEnum[MqttPacketTypeEnum["SUBACK"] = 9] = "SUBACK";
    MqttPacketTypeEnum[MqttPacketTypeEnum["UNSUBSCRIBE"] = 10] = "UNSUBSCRIBE";
    MqttPacketTypeEnum[MqttPacketTypeEnum["UNSUBACK"] = 11] = "UNSUBACK";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PINGREQ"] = 12] = "PINGREQ";
    MqttPacketTypeEnum[MqttPacketTypeEnum["PINGRESP"] = 13] = "PINGRESP";
    MqttPacketTypeEnum[MqttPacketTypeEnum["DISCONNECT"] = 14] = "DISCONNECT";
})(MqttPacketTypeEnum || (MqttPacketTypeEnum = {}));
export default MqttPacketTypeEnum;
//# sourceMappingURL=PacketTypeEnum.js.map