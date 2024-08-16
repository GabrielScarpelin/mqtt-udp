import { networkInterfaces } from "os";

class NetAddr {
  private static readonly ignoreInterfaces: string[] = [
    "docker0",
    "vEthernet",
    "vmnet",
  ];
  public static getLocalIp(): string {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].address;
  }
  public static getNetMask(): string {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].netmask;
  }
  public static getMacAddress(): string {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    return localInterfaces[0].mac;
  }
  public static getBroadcastAddress(): string {
    const localInterfaces = this.findLocalsNetworkInterfaces();
    const ip = localInterfaces[0].address;
    const subnetMask = localInterfaces[0].netmask;
    function ipToBinary(ipPart: string) {
      return ("00000000" + parseInt(ipPart, 10).toString(2)).slice(-8);
    }

    function binaryToIp(binaryPart: string) {
      return parseInt(binaryPart, 2).toString(10);
    }

    const ipBinary = ip.split(".").map(ipToBinary).join("");
    const maskBinary = subnetMask.split(".").map(ipToBinary).join("");

    const broadcastBinary = ipBinary
      .split("")
      .map((bit, index) => (maskBinary[index] === "1" ? bit : "1"))
      .join("");

    const broadcastIp = broadcastBinary
      .match(/.{1,8}/g)
      .map(binaryToIp)
      .join(".");
    return broadcastIp;
  }

  public static findLocalsNetworkInterfaces(): {
    address: string;
    mac: string;
    netmask: string;
  }[] {
    const addresses = Object.entries(networkInterfaces())
      .filter(([name]) => !this.ignoreInterfaces.includes(name))
      .map(([_, addressList]) => addressList)
      .flat();

    const localIpAddresses = addresses
      .filter(
        (addressInfo) => addressInfo.family === "IPv4" && !addressInfo.internal,
      )
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
