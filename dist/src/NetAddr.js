import { networkInterfaces } from "os";
class NetAddr {
    static ignoreInterfaces = [
        "docker0",
        "vEthernet",
        "vmnet",
    ];
    static getLocalIp() {
        const localInterfaces = this.findLocalsNetworkInterfaces();
        return localInterfaces[0].address;
    }
    static getNetMask() {
        const localInterfaces = this.findLocalsNetworkInterfaces();
        return localInterfaces[0].netmask;
    }
    static getMacAddress() {
        const localInterfaces = this.findLocalsNetworkInterfaces();
        return localInterfaces[0].mac;
    }
    static getBroadcastAddress() {
        const localInterfaces = this.findLocalsNetworkInterfaces();
        const ip = localInterfaces[0].address;
        const subnetMask = localInterfaces[0].netmask;
        // Função para converter uma parte do endereço IP para binário
        function ipToBinary(ipPart) {
            return ("00000000" + parseInt(ipPart, 10).toString(2)).slice(-8);
        }
        // Função para converter uma parte binária para decimal
        function binaryToIp(binaryPart) {
            return parseInt(binaryPart, 2).toString(10);
        }
        // Converter IP e Máscara de sub-rede para binário
        const ipBinary = ip.split(".").map(ipToBinary).join("");
        const maskBinary = subnetMask.split(".").map(ipToBinary).join("");
        // Calcular o endereço de broadcast em binário
        const broadcastBinary = ipBinary
            .split("")
            .map((bit, index) => (maskBinary[index] === "1" ? bit : "1"))
            .join("");
        // Converter o endereço de broadcast de binário para decimal
        const broadcastIp = broadcastBinary
            .match(/.{1,8}/g)
            .map(binaryToIp)
            .join(".");
        console.log(broadcastIp);
        return broadcastIp;
    }
    static findLocalsNetworkInterfaces() {
        // Obtenha todas as interfaces de rede e achate o array
        const addresses = Object.entries(networkInterfaces())
            .filter(([name]) => !this.ignoreInterfaces.includes(name)) // Filtra interfaces indesejadas
            .map(([_, addressList]) => addressList)
            .flat();
        // Filtra por endereços IPv4 não internos
        const localIpAddresses = addresses
            .filter((addressInfo) => addressInfo.family === "IPv4" && !addressInfo.internal)
            .map((addressInfo) => {
            return {
                address: addressInfo.address,
                mac: addressInfo.mac,
                netmask: addressInfo.netmask,
            };
        });
        return localIpAddresses;
    }
}
export default NetAddr;
//# sourceMappingURL=NetAddr.js.map