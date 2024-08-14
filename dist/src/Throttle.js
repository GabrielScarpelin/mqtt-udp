class Throttle {
    packetsPerTime;
    ms;
    packetsCount = 0;
    timeout = null;
    queuedPackets = [];
    constructor(packetsPerTime, ms) {
        this.packetsPerTime = packetsPerTime || 10;
        this.ms = ms || 1000;
    }
    send(executeFunction) {
        if (!this.timeout) {
            this._startTimeout();
        }
        if (this.packetsCount < this.packetsPerTime) {
            this.packetsCount++;
            executeFunction();
        }
        else {
            this.queuedPackets.push(executeFunction);
        }
    }
    _startTimeout() {
        this.timeout = setTimeout(() => {
            this.packetsCount = 0;
            this.timeout = null;
            if (this.queuedPackets.length > 0) {
                this._startTimeout();
                this.send(this.queuedPackets.shift());
            }
        }, this.ms);
    }
}
export default Throttle;
//# sourceMappingURL=Throttle.js.map